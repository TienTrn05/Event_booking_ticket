"""Kiểm tra DDL/ràng buộc trên MySQL instance tạm, không kết nối DB có sẵn.

Chạy từ repo: python database/tests/validate_mysql.py --mysqld <đường dẫn mysqld>
Dependency: database/tests/requirements.txt. Xem database/README.md.
"""
from pathlib import Path
import argparse
import concurrent.futures
import hashlib
from datetime import datetime, timezone
import json
import os
import secrets
import socket
import subprocess
import sys
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.local/python'))
import pymysql


def statements(path):
    # Các SQL thiết kế không có procedure/delimiter hoặc dấu ; trong literal.
    source = '\n'.join(line for line in path.read_text(encoding='utf-8').splitlines() if not line.lstrip().startswith('--'))
    return [item.strip() for item in source.split(';') if item.strip()]


def run_checks(connect):
    results = []
    conn = connect()
    cur = conn.cursor()
    for statement in statements(ROOT / 'database/schema.sql'):
        cur.execute(statement)
    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'")
    assert cur.fetchone()[0] == 27
    results.append('DDL: 27 tables imported with foreign keys and checks enabled')
    for _ in range(2):
        for statement in statements(ROOT / 'database/seeds/001-reference-data.sql'):
            cur.execute(statement)
    cur.execute('SELECT COUNT(*) FROM role_permissions')
    assert cur.fetchone()[0] == 0
    results.append('Reference seed repeatable; no roles granted or permission mappings activated')

    def sql(statement, args=None):
        cur.execute(statement, args)
        return cur.lastrowid

    def rejected(label, statement, args=None, code=None):
        cur.execute('SAVEPOINT rejection_test')
        try:
            cur.execute(statement, args)
        except pymysql.MySQLError as exc:
            assert exc.args[0] == code, (label, exc)
            results.append(label)
        else:
            raise AssertionError('Expected database rejection: ' + label)
        finally:
            cur.execute('ROLLBACK TO SAVEPOINT rejection_test')

    conn.begin()
    for uid in (1,2,3):
        sql("INSERT INTO users(id,email_canonical,display_name,password_hash,status) VALUES (%s,%s,'Test','TEST_ONLY_NOT_A_LOGIN_HASH','ACTIVE')", (uid, f'u{uid}@example.invalid'))
    sql("INSERT INTO event_categories(id,name,slug) VALUES (1,'Test','test')")
    sql("INSERT INTO events(id,organizer_id,category_id,title,slug,description,status) VALUES (1,3,1,'Test','test','Test','PUBLISHED')")
    sql("INSERT INTO venues(id,owner_id,name,address,city,timezone) VALUES (1,3,'Test','Test','Test','Asia/Ho_Chi_Minh')")
    sql("INSERT INTO venue_sections(id,venue_id,code,name) VALUES (1,1,'A','A')")
    sql("INSERT INTO venue_rows(id,section_id,code) VALUES (1,1,'R')")
    for sid in (1,2):
        sql("INSERT INTO seats(id,row_id,number,map_x,map_y) VALUES (%s,1,%s,0,0)", (sid,str(sid)))
        sql("INSERT INTO event_sessions(id,event_id,venue_id,starts_at,ends_at,timezone,sale_opens_at,sale_closes_at) VALUES (%s,1,1,'2099-01-01 12:00:00','2099-01-01 14:00:00','Asia/Ho_Chi_Minh','2020-01-01','2099-01-01 12:00:00')", (sid,))
    for iid, session, seat in ((1,1,1),(2,1,2),(3,2,1)):
        sql("INSERT INTO session_seats(id,session_id,seat_id,price_minor,currency) VALUES (%s,%s,%s,100,'VND')",(iid,session,seat))
    conn.commit()
    results.append('Same physical seat can exist independently across two sessions')

    conn.begin()
    rejected('Duplicate session-seat rejected', "INSERT INTO session_seats(session_id,seat_id,price_minor,currency) VALUES (1,1,100,'VND')", code=1062)
    rejected('Negative price rejected', 'UPDATE session_seats SET price_minor=-1 WHERE id=1', code=3819)
    rejected('Invalid currency rejected', "UPDATE session_seats SET currency='vnd' WHERE id=1", code=3819)
    rejected('HELD without owner/expiry rejected', "UPDATE session_seats SET status='HELD' WHERE id=1", code=3819)
    for hid, uid, session in ((1,1,1),(2,2,1),(3,1,2)):
        sql("INSERT INTO seat_holds(id,customer_id,session_id,expires_at) VALUES (%s,%s,%s,'2099-01-01')",(hid,uid,session))
    rejected('Hold item crossing sessions rejected', "INSERT INTO seat_hold_items(hold_id,session_seat_id,session_id,price_minor,currency) VALUES (1,3,1,100,'VND')", code=1452)
    rejected('Booking cannot steal another customer hold', "INSERT INTO bookings(customer_id,session_id,hold_id,total_minor,currency,expires_at) VALUES (2,1,1,100,'VND','2099-01-01')",code=1452)
    for bid, uid, hid in ((1,1,1),(2,2,2)):
        sql("INSERT INTO bookings(id,customer_id,session_id,hold_id,total_minor,currency,expires_at) VALUES (%s,%s,1,%s,100,'VND','2099-01-01')",(bid,uid,hid))
        sql("INSERT INTO booking_items(id,booking_id,session_seat_id,session_id,price_minor,currency,seat_label_snapshot) VALUES (%s,%s,1,1,100,'VND','A-R-1')",(bid,bid))
    rejected('One booking per hold enforced', "INSERT INTO bookings(customer_id,session_id,hold_id,total_minor,currency,expires_at) VALUES (1,1,1,100,'VND','2099-01-01')",code=1062)
    rejected('Booking item crossing sessions rejected', "INSERT INTO booking_items(booking_id,session_seat_id,session_id,price_minor,currency,seat_label_snapshot) VALUES (1,3,1,100,'VND','bad')",code=1452)
    sql("INSERT INTO payments(id,booking_id,provider,provider_key,amount_minor,currency) VALUES (1,1,'mock','p1',100,'VND')")
    rejected('Concurrent pending attempts rejected', "INSERT INTO payments(booking_id,provider,provider_key,amount_minor,currency) VALUES (1,'mock','p2',100,'VND')",code=1062)
    sql("UPDATE payments SET status='SUCCESS' WHERE id=1")
    sql("INSERT INTO payments(id,booking_id,provider,provider_key,amount_minor,currency,status,reconciliation_status,reconciliation_reason) VALUES (2,1,'mock','p2',100,'VND','SUCCESS','REQUIRED','Unexpected second receipt')")
    results.append('Unexpected second successful receipt preserved for reconciliation')
    sql("INSERT INTO payments(id,booking_id,provider,provider_key,amount_minor,currency,status) VALUES (3,2,'mock','p3',100,'VND','SUCCESS')")
    rejected('Confirmed payment must belong to same booking', "UPDATE bookings SET status='CONFIRMED',confirmed_at=NOW(6),confirmed_payment_id=3 WHERE id=1",code=1452)
    sql("UPDATE bookings SET status='CONFIRMED',confirmed_at=NOW(6),confirmed_payment_id=1 WHERE id=1")
    sql("UPDATE session_seats SET status='SOLD',current_booking_id=1 WHERE id=1")
    token = secrets.token_bytes(32)
    ticket_args = (token, b'test_ciphertext', 'test-key')
    sql("INSERT INTO tickets(id,booking_item_id,session_seat_id,qr_token_hash,qr_token_ciphertext,qr_key_version) VALUES (1,1,1,%s,%s,%s)",ticket_args)
    rejected('Two active tickets for one session-seat rejected', "INSERT INTO tickets(booking_item_id,session_seat_id,qr_token_hash,qr_token_ciphertext,qr_key_version) VALUES (2,1,%s,%s,%s)",(secrets.token_bytes(32),b'test','test-key'),1062)
    rejected('USED ticket requires check-in audit fields', "UPDATE tickets SET status='USED' WHERE id=1",code=3819)
    sql("INSERT INTO refunds(id,payment_id,type,amount_minor,reason,provider,provider_key) VALUES (1,1,'CUSTOMER',100,'Test','mock','r1')")
    rejected('Duplicate full refund rejected', "INSERT INTO refunds(payment_id,type,amount_minor,reason,provider,provider_key) VALUES (1,'CUSTOMER',100,'Test','mock','r2')",code=1062)
    sql("INSERT INTO payment_webhooks(provider,provider_event_id,payment_id,payload_hash,normalized_payload) VALUES ('mock','e1',1,%s,%s)",(secrets.token_bytes(32),json.dumps({'outcome':'SUCCESS','amountMinor':'100','currency':'VND','reference':'test'})))
    rejected('Duplicate webhook event rejected', "INSERT INTO payment_webhooks(provider,provider_event_id,payment_id,payload_hash,normalized_payload) VALUES ('mock','e1',1,%s,'{}')",(secrets.token_bytes(32),),1062)
    rejected('Referenced user cannot be deleted', 'DELETE FROM users WHERE id=1',code=1451)
    rejected('Partial idempotency result with NULL response rejected',
             "INSERT INTO idempotency_records(actor_scope,operation,idempotency_key,request_hash,resource_type,resource_id,expires_at) VALUES ('user:1','hold','k',%s,'hold',1,'2099-01-01')",(secrets.token_bytes(32),),3819)
    token_a, token_b = secrets.token_bytes(16), secrets.token_bytes(16)
    job_id = sql("INSERT INTO outbox_messages(type,aggregate_type,aggregate_id,aggregate_version,dedupe_key,payload_minimal,status,available_at,lease_until,lease_token) VALUES ('TEST','booking',1,1,'job1','{}','PROCESSING',NOW(6),'2099-01-01',%s)",(token_a,))
    sql('UPDATE outbox_messages SET lease_token=%s WHERE id=%s',(token_b,job_id))
    cur.execute("UPDATE outbox_messages SET status='DONE',lease_until=NULL,lease_token=NULL WHERE id=%s AND lease_token=%s",(job_id,token_a))
    assert cur.rowcount == 0
    cur.execute("UPDATE outbox_messages SET status='DONE',lease_until=NULL,lease_token=NULL WHERE id=%s AND lease_token=%s",(job_id,token_b))
    assert cur.rowcount == 1
    results.append('Stale worker cannot acknowledge a newer lease token')
    conn.rollback()
    cur.execute('SELECT COUNT(*) FROM bookings')
    assert cur.fetchone()[0] == 0
    results.append('Rollback restores all booking/payment/ticket changes')

    # Test thật trên connection riêng: hai người đồng thời ghi cùng ghế.
    barrier = threading.Barrier(2)
    def contender(uid):
        c = connect()
        try:
            with c.cursor() as q:
                c.begin()
                q.execute('SELECT id FROM events WHERE id=1 FOR SHARE')
                q.execute('SELECT id FROM event_sessions WHERE id=1 FOR SHARE')
                q.execute("INSERT INTO seat_holds(customer_id,session_id,expires_at) VALUES (%s,1,'2099-01-01')",(uid,))
                hold = q.lastrowid
                barrier.wait(timeout=10)
                q.execute('SELECT status FROM session_seats WHERE id=2 FOR UPDATE')
                status = q.fetchone()[0]
                if status != 'AVAILABLE':
                    c.rollback()
                    return 'CONFLICT'
                q.execute("UPDATE session_seats SET status='HELD',hold_id=%s,hold_expires_at='2099-01-01',version=version+1 WHERE id=2",(hold,))
                q.execute("INSERT INTO seat_hold_items(hold_id,session_seat_id,session_id,price_minor,currency) VALUES (%s,2,1,100,'VND')",(hold,))
                c.commit()
                return 'HELD'
        finally:
            c.close()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(contender, [1,2]))
    assert sorted(outcomes) == ['CONFLICT','HELD'], outcomes
    cur.execute('SELECT COUNT(*) FROM seat_holds')
    assert cur.fetchone()[0] == 1
    results.append('Two real connections race for same seat: one HELD, one CONFLICT, no orphan hold')
    cur.execute("SET @session_id=1, @organizer_id=3, @from_utc='2020-01-01', @to_utc='2100-01-01'")
    for filename, expected in [('01-session-inventory.sql',2),('02-organizer-sales.sql',0),('03-integrity-audit.sql',0)]:
        for statement in statements(ROOT/'database/queries'/filename):
            cur.execute(statement)
            assert len(cur.fetchall()) == expected, filename
        results.append('Read query compiled and fixture result checked: '+filename)
    cur.execute('SELECT VERSION(), @@transaction_isolation, @@foreign_key_checks')
    version, isolation, fk = cur.fetchone()
    assert isolation == 'READ-COMMITTED' and fk == 1
    conn.close()
    return {'checked_at_utc': datetime.now(timezone.utc).isoformat(),
            'schema_sha256': hashlib.sha256((ROOT/'database/schema.sql').read_bytes()).hexdigest(),
            'test_script_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'mysql_version': version, 'isolation': isolation, 'checks_passed': len(results), 'checks': results,
            'limitations': ['Schema and a focused lock race only; not a backend/API/E2E test suite.',
                           'Policy-dependent schema is a proposal, not an approved production migration.',
                           'MySQL 8.4 is a design target; validation version is recorded above.']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mysqld', required=True)
    args = parser.parse_args()
    binary = Path(args.mysqld).resolve(strict=True)
    local = ROOT / '.local'
    local.mkdir(exist_ok=True)
    # Giữ datadir test trong .local để có thể điều tra; không xóa dữ liệu có sẵn.
    work = Path(tempfile.mkdtemp(prefix='mysql-schema-', dir=local)).resolve()
    assert work.is_relative_to(local.resolve())
    data = work / 'data'
    data.mkdir()
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    initialized = subprocess.run([str(binary),'--no-defaults','--initialize-insecure',f'--datadir={data}',
                                  f'--basedir={binary.parent.parent}',f'--log-error={work / "initialize.log"}'],
                                 capture_output=True, creationflags=flags, timeout=120)
    if initialized.returncode:
        raise RuntimeError(f'MySQL initialization failed. Inspect {work / "initialize.log"}')
    password = secrets.token_hex(32)
    init_file = work / 'init.sql'
    init_file.write_text(f"ALTER USER 'root'@'localhost' IDENTIFIED BY '{password}';\n",encoding='ascii')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0))
        port = sock.getsockname()[1]
    proc = subprocess.Popen([str(binary),'--no-defaults',f'--datadir={data}',f'--basedir={binary.parent.parent}',
                             '--bind-address=127.0.0.1',f'--port={port}','--mysqlx=OFF','--skip-log-bin',
                             '--innodb-buffer-pool-size=64M',f'--init-file={init_file}',f'--log-error={work / "server.log"}'],
                            stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags)
    admin = None
    try:
        for _ in range(100):
            if proc.poll() is not None:
                raise RuntimeError(f'MySQL test server exited. Inspect {work / "server.log"}')
            try:
                admin = pymysql.connect(host='127.0.0.1',port=port,user='root',password=password,autocommit=True,connect_timeout=2)
                break
            except pymysql.MySQLError:
                time.sleep(0.2)
        if admin is None:
            raise RuntimeError('Temporary MySQL startup timed out')
        init_file.unlink()
        with admin.cursor() as q:
            q.execute('CREATE DATABASE schema_validation CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs')
        def connect():
            c = pymysql.connect(host='127.0.0.1',port=port,user='root',password=password,database='schema_validation',
                                charset='utf8mb4',autocommit=True,read_timeout=20,write_timeout=20)
            with c.cursor() as q:
                q.execute("SET time_zone='+00:00'")
                q.execute('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED')
                q.execute('SET SESSION innodb_lock_wait_timeout=10')
            return c
        report = run_checks(connect)
        (ROOT/'database/tests/validation-result.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        print(json.dumps(report,indent=2,ensure_ascii=True), flush=True)
    finally:
        if init_file.exists():
            init_file.unlink()
        if admin:
            try:
                with admin.cursor() as q:
                    q.execute('SHUTDOWN')
            except pymysql.MySQLError:
                pass
            admin.close()
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.terminate()
            proc.wait(timeout=15)


if __name__ == '__main__':
    main()
