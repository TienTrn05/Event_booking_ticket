// Read-only source snapshot -> a separate, owned temporary PostgreSQL cluster.
import { mkdir, readFile, rm } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import pg from 'pg';
import { parse } from 'dotenv';
const root = fileURLToPath(new URL('../', import.meta.url)),
  workspace = resolve(root, '..'),
  temporaryRoot = resolve(root, 'tmp');
const directory = resolve(temporaryRoot, 'restore-' + Date.now()),
  backup = resolve(workspace, 'backups', 'restore-drill-' + Date.now() + '.dump');
if (
  !directory.startsWith(temporaryRoot + sep) ||
  !backup.startsWith(resolve(workspace, 'backups') + sep)
)
  throw new Error('Unsafe drill path');
const settings = parse(await readFile(resolve(root, '.env'), 'utf8'));
const source = new pg.Client({
  host: settings.DB_HOST,
  port: Number(settings.DB_PORT),
  user: settings.DB_USER,
  password: settings.DB_PASSWORD,
  database: settings.DB_NAME,
});
const bin =
  process.env.PG_TEST_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/PostgreSQL/18/bin'
    : execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim());
const executable = (name) => join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
const run = (name, args, environment = process.env) =>
  execFileSync(executable(name), args, {
    env: environment,
    stdio: 'ignore',
    windowsHide: true,
    timeout: 120000,
  });
const listener = createServer();
await new Promise((done) => listener.listen(0, '127.0.0.1', done));
const port = listener.address().port;
await new Promise((done) => listener.close(done));
const target = new pg.Client({
  host: '127.0.0.1',
  port,
  user: 'restore_fixture',
  database: 'postgres',
});
let started = false,
  phase = 'CONNECT';
const beginning = Date.now();
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
async function fingerprints(client) {
  const result = [];
  const tables = (
    await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  for (const row of tables) {
    const data = (
      await client.query(
        `SELECT count(*)::text AS count,md5(COALESCE(string_agg(fingerprint,'' ORDER BY fingerprint),'')) AS fingerprint FROM (SELECT md5(row_to_json(t)::text) AS fingerprint FROM public.${quote(row.tablename)} t) x`,
      )
    ).rows[0];
    result.push({ table: row.tablename, ...data });
  }
  return result;
}
async function metadata(client) {
  return (
    await client.query(
      "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
    )
  ).rows;
}
try {
  await source.connect();
  await source.query("SET TIME ZONE 'UTC'");
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const snapshot = (await source.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
  phase = 'BACKUP';
  await mkdir(resolve(workspace, 'backups'), { recursive: true });
  run(
    'pg_dump',
    [
      '-h',
      settings.DB_HOST,
      '-p',
      settings.DB_PORT,
      '-U',
      settings.DB_USER,
      '-d',
      settings.DB_NAME,
      '--snapshot',
      snapshot,
      '-Fc',
      '-f',
      backup,
    ],
    { ...process.env, PGPASSWORD: settings.DB_PASSWORD },
  );
  run('pg_restore', ['--list', backup]);
  const before = await fingerprints(source),
    columns = await metadata(source);
  await source.query('COMMIT');
  phase = 'RESTORE';
  await mkdir(directory, { recursive: true });
  run('initdb', [
    '-D',
    directory,
    '-U',
    'restore_fixture',
    '--auth=trust',
    '--encoding=UTF8',
    '--locale=C',
    '--no-sync',
  ]);
  run('pg_ctl', [
    '-D',
    directory,
    '-l',
    join(directory, 'server.log'),
    '-o',
    `-h 127.0.0.1 -p ${port}`,
    '-w',
    'start',
  ]);
  started = true;
  run('pg_restore', [
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'restore_fixture',
    '-d',
    'postgres',
    '--no-owner',
    '--no-privileges',
    '--exit-on-error',
    backup,
  ]);
  await target.connect();
  await target.query("SET TIME ZONE 'UTC'");
  phase = 'VERIFY';
  if (
    JSON.stringify(before) !== JSON.stringify(await fingerprints(target)) ||
    JSON.stringify(columns) !== JSON.stringify(await metadata(target))
  )
    throw new Error('Restore data/metadata mismatch');
  const constraints = await target.query(
    "SELECT count(*)::int AS count FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated",
  );
  if (constraints.rows[0].count !== 0) throw new Error('Restore has unvalidated constraints');
  let keyProbe = false;
  if (settings.TICKET_ENCRYPTION_KEY && settings.ATTENDEE_PII_KEY) {
    const tickets = await import('../dist/modules/tickets/issuance/ticket.crypto.js'),
      attendees = await import('../dist/modules/tickets/attendees/attendee.crypto.js');
    const issued = tickets.issueCode('1', '1'),
      person = attendees.encryptCccd('000000000000', '1', '1');
    await target.query('CREATE TEMP TABLE recovery_probe(ciphertext BYTEA,hash BYTEA,mac BYTEA)');
    await target.query('INSERT INTO recovery_probe VALUES($1,$2,$3)', [
      issued.ciphertext,
      issued.hash,
      person.mac,
    ]);
    const probe = (await target.query('SELECT * FROM recovery_probe')).rows[0];
    keyProbe =
      tickets
        .ticketHash(tickets.revealCode(probe.ciphertext, '1', '1', issued.version))
        .equals(probe.hash) && attendees.matchesCccd('000000000000', '1', probe.mac);
    if (!keyProbe) throw new Error('Recovery keys probe failed');
  }
  console.log(
    JSON.stringify({
      restored: true,
      tables: before.length,
      rows: before.reduce((sum, r) => sum + Number(r.count), 0),
      columnsMatched: true,
      dataMatched: true,
      keysProbe: keyProbe,
      sourceReadOnly: true,
      backup: backup.slice(workspace.length + 1),
      backupBytes: statSync(backup).size,
      durationSeconds: Math.ceil((Date.now() - beginning) / 1000),
    }),
  );
} catch {
  console.error('Restore drill failed at ' + phase + '; no source data was written.');
  process.exitCode = 1;
} finally {
  await source.query('ROLLBACK').catch(() => {});
  await source.end().catch(() => {});
  await target.end().catch(() => {});
  try {
    if (started) run('pg_ctl', ['-D', directory, '-m', 'fast', '-w', 'stop']);
  } finally {
    if (directory.startsWith(temporaryRoot + sep))
      await rm(directory, { recursive: true, force: true });
  }
}
