import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import pg from 'pg';
const external = process.env.PG_COMMERCE_EXTERNAL === '1';
if (
  external &&
  process.env.CI !== 'true' &&
  process.env.PG_COMMERCE_ACK !== 'isolated-fixture-service'
)
  throw new Error('External PostgreSQL is restricted to an isolated fixture service');
const createdDatabases = [];
const root = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = resolve(root, 'tmp');
const directory = resolve(temporaryRoot, `commerce-${Date.now()}`);
if (!directory.startsWith(temporaryRoot + sep)) throw new Error('Invalid temporary directory');
const bin = process.env.PG_TEST_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const executable = (name) => join(bin, process.platform === 'win32' ? name + '.exe' : name);
const server = createServer();
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = external ? Number(process.env.COMMERCE_TEST_DB_PORT ?? '5432') : server.address().port;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid fixture port');
await new Promise((done) => server.close(done));
let started = false;
async function load(name, sql) {
  const client = new pg.Client({
    host: '127.0.0.1',
    port,
    user: 'validation_fixture',
    password: external ? 'validation_fixture_only' : undefined,
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
  if (!external) {
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
  }
  if (external) {
    const guard = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'validation_fixture',
      password: 'validation_fixture_only',
      database: 'postgres',
    });
    try {
      await guard.connect();
      const identity = (await guard.query('SELECT current_user AS name')).rows[0];
      if (identity.name !== 'validation_fixture') throw new Error('Unexpected fixture identity');
    } finally {
      await guard.end();
    }
  }
  await load('postgres', 'CREATE DATABASE validation_fixture');
  createdDatabases.push('validation_fixture');
  await load('postgres', 'CREATE DATABASE validation_upgrade');
  createdDatabases.push('validation_upgrade');
  const schema = await readFile(resolve(root, '../database/schema.sql'), 'utf8');
  await load('validation_fixture', schema);
  const before007 = schema.slice(0, schema.indexOf('-- One payOS channel;')) + '\nCOMMIT;';
  await load('validation_upgrade', before007);
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/007-payos-payment.sql'), 'utf8'),
  );
  for (const file of ['001-reference-data.sql', '002-public-catalog.sql']) {
    const seed = await readFile(
      resolve(
        root,
        file === '002-public-catalog.sql'
          ? 'tests/fixtures/catalog-before-011.sql'
          : '../database/seeds/001-reference-data.sql',
      ),
      'utf8',
    );
    await load(
      'validation_upgrade',
      seed
        .replaceAll('contact_domain', 'company_domain')
        .replaceAll('applicant_identity_id', 'company_identity_id')
        .replaceAll('applicant_identity_provider', 'company_identity_provider')
        .replaceAll('member_identity_id', 'company_identity_id')
        .replaceAll('member_identity_provider', 'company_identity_provider'),
    );
  }
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/008-registration-onboarding.sql'), 'utf8'),
  );
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/009-session-pricing-config.sql'), 'utf8'),
  );
  await load(
    'validation_upgrade',
    await readFile(
      resolve(root, '../database/migrations/010-admin-onboarding-questions.sql'),
      'utf8',
    ),
  );
  const upgrade = new pg.Client({
    host: '127.0.0.1',
    port,
    user: 'validation_fixture',
    password: external ? 'validation_fixture_only' : undefined,
    database: 'validation_upgrade',
  });
  try {
    await upgrade.connect();
    await upgrade.query(
      "UPDATE events SET cover_image_url='https://fixture.invalid/draft-cover.png' WHERE id=905001",
    );
    const before = (
      await upgrade.query(
        'SELECT (SELECT count(*) FROM outbox_messages)::int AS messages,(SELECT updated_at FROM events WHERE id=905001) AS updated_at',
      )
    ).rows[0];
    await upgrade.query(
      await readFile(
        resolve(root, '../database/migrations/011-merge-catalog-metadata.sql'),
        'utf8',
      ),
    );
    const after = (
      await upgrade.query(
        "SELECT (SELECT count(*) FROM outbox_messages)::int AS messages,(SELECT updated_at FROM events WHERE id=905001) AS updated_at,(SELECT count(*) FROM organizations WHERE public_id IS NOT NULL)::int AS profiles,(SELECT count(*) FROM events WHERE public_id IS NOT NULL)::int AS publications,(SELECT count(*) FROM events WHERE publication_cover_image_url IS NOT NULL)::int AS covers,(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')::int AS tables,to_regclass('public.organization_profiles') IS NULL AND to_regclass('public.event_publications') IS NULL AS removed,(SELECT cover_image_url<>publication_cover_image_url FROM events WHERE id=905001) AS distinct_covers",
      )
    ).rows[0];
    if (
      after.tables !== 45 ||
      after.profiles !== 12 ||
      after.publications !== 13 ||
      after.covers !== 13 ||
      !after.removed ||
      !after.distinct_covers ||
      after.messages !== before.messages ||
      +after.updated_at !== +before.updated_at
    )
      throw new Error('Catalog merge preservation failed');
  } finally {
    await upgrade.end();
  }
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/012-refunds-feedback.sql'), 'utf8'),
  );
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/013-organizer-operations.sql'), 'utf8'),
  );
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/014-organizer-blocks.sql'), 'utf8'),
  );
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/015-event-search-outbox.sql'), 'utf8'),
  );
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/016-outdoor-zone-inventory.sql'), 'utf8'),
  );
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/017-backend-v1-extensions.sql'), 'utf8'),
  );
  await load(
    'validation_upgrade',
    await readFile(resolve(root, '../database/migrations/018-dynamic-rbac.sql'), 'utf8'),
  );
  const columns =
    "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('roles','permissions','user_roles','role_permissions','payments','users','organizations','organization_memberships','event_sessions','onboarding_questionnaires','events','refunds','feedback','event_change_requests','notifications','organization_blocks','seat_layouts','layout_sections','session_seats','merchandise_products','merchandise_skus','merchandise_orders','merchandise_order_items','organization_reputation_entries','support_reports','event_reviews') ORDER BY table_name,ordinal_position";
  async function metadata(name) {
    const client = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'validation_fixture',
      password: external ? 'validation_fixture_only' : undefined,
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
  console.log('Fresh schema and populated upgrades 007–018 agree; isolated PostgreSQL ready.');
  for (let n = 0; n < 2; n++)
    await load(
      'validation_fixture',
      await readFile(resolve(root, '../database/seeds/003-local-ticket-sales.sql'), 'utf8'),
    );
  const demo = new pg.Client({
    host: '127.0.0.1',
    port,
    user: 'validation_fixture',
    password: external ? 'validation_fixture_only' : undefined,
    database: 'validation_fixture',
  });
  try {
    await demo.connect();
    const row = (
      await demo.query(
        'SELECT (SELECT count(*) FROM session_seats WHERE session_id=970003)::int AS seats,(SELECT count(*) FROM payments)::int AS payments,(SELECT status FROM events WHERE id=970001) AS status',
      )
    ).rows[0];
    if (row.seats !== 12 || row.payments !== 0 || row.status !== 'PUBLISHED')
      throw new Error('Local sales demo or idempotency failed');
  } finally {
    await demo.end();
  }
  const certificateSetup = spawnSync(process.execPath, [resolve(root, 'scripts/setup-https.mjs')], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (certificateSetup.status !== 0) throw new Error('Local HTTPS setup failed');
  const child = spawnSync(
    process.execPath,
    [
      resolve(root, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--config',
      'vitest.config.ts',
      '--no-file-parallelism',
      'tests/commerce.integration.test.ts',
      'tests/auth.integration.test.ts',
      'tests/onboarding.integration.test.ts',
      'tests/https.integration.test.ts',
      'tests/operations.integration.test.ts',
      'tests/backend-completion.integration.test.ts',
      'tests/search.integration.test.ts',
      'tests/outdoor.integration.test.ts',
      'tests/v1-extensions.integration.test.ts',
      'tests/rbac.integration.test.ts',
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
  if (external) {
    for (const name of createdDatabases) {
      await load('postgres', `DROP DATABASE ${name} WITH (FORCE)`);
    }
  }
  if (started)
    execFileSync(executable('pg_ctl'), ['-D', directory, '-m', 'fast', '-w', 'stop'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  if (!external && directory.startsWith(temporaryRoot + sep))
    await rm(directory, { recursive: true, force: true });
  else if (!external) process.exitCode = 1;
}
