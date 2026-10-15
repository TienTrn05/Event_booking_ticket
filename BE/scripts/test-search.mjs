import { config } from 'dotenv';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
config({ quiet: true });
const endpoint = process.env.SEARCH_TEST_URL ?? process.env.ELASTICSEARCH_URL;
if (!endpoint || !['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname))
  throw new Error('Search integration requires an isolated local Elasticsearch fixture.');
const username = process.env.SEARCH_TEST_USERNAME ?? process.env.ELASTICSEARCH_USERNAME;
const password = process.env.SEARCH_TEST_PASSWORD ?? process.env.ELASTICSEARCH_PASSWORD;
if (!username || !password) throw new Error('Local search fixture credentials are missing.');
const adminAuth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
const index = 'eventix-search-fixture-' + Date.now();
let keyId, key;
async function request(path, method, body, authorization = adminAuth, accepted = [200]) {
  const response = await fetch(new URL(path, endpoint), {
    method,
    headers: {
      Authorization: authorization,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!accepted.includes(response.status)) throw new Error('Search fixture management failed.');
  return method === 'HEAD' || response.status === 404 ? null : await response.json();
}
try {
  const credentials = await request('/_security/api_key', 'POST', {
    name: index,
    expiration: '15m',
    role_descriptors: { fixture: { indices: [{ names: [index], privileges: ['all'] }] } },
  });
  if (typeof credentials.id !== 'string' || typeof credentials.encoded !== 'string')
    throw new Error('Invalid fixture API key response.');
  keyId = credentials.id;
  key = credentials.encoded;
  const child = spawn(process.execPath, [resolve('scripts/test-commerce.mjs')], {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      SEARCH_TEST_URL: endpoint,
      SEARCH_TEST_INDEX: index,
      SEARCH_TEST_KEY: key,
    },
  });
  process.exitCode = await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => done(code ?? 1));
  });
} finally {
  if (key && /^eventix-search-fixture-[0-9]+$/.test(index))
    await request('/' + index, 'DELETE', undefined, 'ApiKey ' + key, [200, 404]);
  if (keyId) await request('/_security/api_key', 'DELETE', { ids: [keyId] });
  console.log('Search fixture index/API key cleaned; application index preserved.');
}
