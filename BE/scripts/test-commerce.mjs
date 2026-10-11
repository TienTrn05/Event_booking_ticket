import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import pg from 'pg';
const root = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = resolve(root, 'tmp');
const directory = resolve(temporaryRoot, `commerce-${Date.now()}`);
if (!directory.startsWith(temporaryRoot + sep)) throw new Error('Invalid temporary directory');
const bin = process.env.PG_TEST_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const executable = (name) => join(bin, process.platform === 'win32' ? name + '.exe' : name);
const server = createServer();
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
await new Promise((done) => server.close(done));
let started = false;
async function load(name, sql) {
  const client = new pg.Client({
    host: '127.0.0.1',
    port,
    user: 'validation_fixture',
    database: name,
  });
  try {
    await client.connect();
    await client.query(sql);
  } finally {
    await client.end();
  }
}
try {
  await mkdir(directory, { recursive: true });
  execFileSync(
    executable('initdb'),
    [
      '-D',
      directory,
      '-U',
      'validation_fixture',
      '--auth=trust',
      '--encoding=UTF8',
      '--locale=C',
      '--no-sync',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  execFileSync(
    executable('pg_ctl'),
    [
      '-D',
      directory,
      '-l',
      join(directory, 'server.log'),
      '-o',
      `-h 127.0.0.1 -p ${port}`,
      '-w',
      'start',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  started = true;
  await load('postgres', 'CREATE DATABASE validation_fixture');
  await load('postgres', 'CREATE DATABASE validation_upgrade');
  const schema = await readFile(resolve(root, '../database/schema.sql'), 'utf8');
  await load('validation_fixture', schema);
  const before007 = schema.slice(0, schema.indexOf('-- One payOS channel;')) + '\nCOMMIT;';
  await load('validation_upgrade', before007);
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/007-payos-payment.sql'), 'utf8'),
  );
  const columns =
    "SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' ORDER BY ordinal_position";
  async function metadata(name) {
    const client = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'validation_fixture',
      database: name,
    });
    try {
      await client.connect();
      return (await client.query(columns)).rows;
    } finally {
      await client.end();
    }
  }
  if (
    JSON.stringify(await metadata('validation_fixture')) !==
    JSON.stringify(await metadata('validation_upgrade'))
  )
    throw new Error('Fresh/upgrade payment schema mismatch');
  for (const file of ['001-reference-data.sql', '002-public-catalog.sql'])
    await load(
      'validation_fixture',
      await readFile(resolve(root, '../database/seeds', file), 'utf8'),
    );
  console.log('Fresh schema and migration 007 agree; isolated PostgreSQL ready.');
  const child = spawnSync(
    process.execPath,
    [
      resolve(root, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--config',
      'vitest.config.ts',
      'tests/commerce.integration.test.ts',
    ],
    {
      cwd: root,
      env: { ...process.env, COMMERCE_TEST_DB_PORT: String(port), COMMERCE_TEST_APP_PORT: '62137' },
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  process.exitCode = child.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Commerce verification failed');
  process.exitCode = 1;
} finally {
  if (started)
    execFileSync(executable('pg_ctl'), ['-D', directory, '-m', 'fast', '-w', 'stop'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  if (directory.startsWith(temporaryRoot + sep))
    await rm(directory, { recursive: true, force: true });
  else process.exitCode = 1;
}
