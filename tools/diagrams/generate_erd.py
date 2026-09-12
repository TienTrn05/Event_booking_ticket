"""Sinh ERD theo module từ DDL, không duy trì hai bản danh sách FK thủ công."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SQL = (ROOT / 'database/schema.sql').read_text(encoding='utf-8')
TABLES = dict(re.findall(r'CREATE TABLE (\w+) \((.*?)\n\) ENGINE', SQL, re.S))
GROUPS = {
    '05-erd-identity': ['users', 'roles', 'permissions', 'user_roles', 'role_permissions', 'auth_sessions', 'refresh_tokens', 'verification_tokens'],
    '06-erd-events': ['users', 'event_categories', 'events', 'venues', 'venue_sections', 'venue_rows', 'seats', 'event_sessions', 'session_seats'],
    '07-erd-booking': ['users', 'event_sessions', 'session_seats', 'seat_holds', 'seat_hold_items', 'bookings', 'booking_items', 'payments', 'tickets', 'refunds'],
    '08-erd-operations': ['users', 'payments', 'payment_webhooks', 'idempotency_records', 'outbox_messages', 'audit_logs'],
}
IMPORTANT = {'id', 'code', 'status', 'expires_at', 'currency', 'amount_minor', 'price_minor', 'total_minor',
             'hold_expires_at', 'provider_reference', 'provider_key', 'provider_event_id', 'lease_token',
             'lease_until', 'reconciliation_status', 'token_hash', 'qr_token_hash', 'auth_version',
             'email_canonical', 'starts_at', 'ends_at', 'operation', 'actor_scope', 'idempotency_key', 'dedupe_key'}
for filename, names in GROUPS.items():
    lines = ['erDiagram']
    for name in names:
        body = TABLES[name]
        pk_match = re.search(r'PRIMARY KEY \(([^)]+)\)', body)
        pk = {c.strip() for c in pk_match.group(1).split(',')}
        fk = {c.strip() for group in re.findall(r'FOREIGN KEY \(([^)]+)\)', body) for c in group.split(',')}
        if name == 'bookings':
            fk.add('confirmed_payment_id')
        lines.append(f'    {name} {{')
        for line in body.splitlines():
            match = re.match(r'    (\w+) (BIGINT|INT|SMALLINT|VARCHAR|CHAR|BINARY|VARBINARY|DATETIME|BOOLEAN|DECIMAL|JSON|TEXT)\b', line)
            if not match:
                continue
            col, kind = match.groups()
            if col not in IMPORTANT and col not in fk and col not in pk and not col.endswith('_guard'):
                continue
            flags = ','.join(flag for flag, yes in [('PK', col in pk), ('FK', col in fk)] if yes)
            lines.append(f'        {kind.lower()} {col}' + (f' {flags}' if flags else ''))
        lines.append('    }')
    for child in names:
        body = TABLES[child]
        relations = re.findall(r'FOREIGN KEY \(([^)]+)\)\s+REFERENCES (\w+)\(([^)]+)\)', body)
        if child == 'bookings':
            relations.append(('confirmed_payment_id, id', 'payments', 'id, booking_id'))
        for columns, parent, _ in relations:
            if parent not in names:
                continue
            cols = [c.strip() for c in columns.split(',')]
            nullable = any(re.search(r'^    '+re.escape(c)+r' .*?\bNULL(?:,|\s*$)', body, re.M)
                           and not re.search(r'^    '+re.escape(c)+r' .*?\bNOT NULL', body, re.M) for c in cols)
            # UQ là subset FK thì phía con tối đa một; ngược lại là 1:N.
            uniques = [set(c.strip() for c in group.split(',')) for group in re.findall(r'UNIQUE KEY \w+ \(([^)]+)\)', body)]
            one_child = any(u.issubset(set(cols)) for u in uniques)
            if child == 'bookings' and cols[0] == 'confirmed_payment_id':
                one_child = True
            left = '|o' if nullable else '||'
            right = 'o|' if one_child else 'o{'
            lines.append(f'    {parent} {left}--{right} {child} : "{cols[0]}"')
    (ROOT / 'docs/diagrams' / (filename + '.mmd')).write_text('\n'.join(lines)+'\n', encoding='utf-8')
print(f'Generated {len(GROUPS)} ERDs from {len(TABLES)} SQL tables')
