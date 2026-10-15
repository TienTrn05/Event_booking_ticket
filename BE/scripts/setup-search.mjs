import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
const path = fileURLToPath(new URL('../.env', import.meta.url));
let content = readFileSync(path, 'utf8');
const existing = parse(content);
if (
  existing.ELASTICSEARCH_API_KEY ||
  (existing.ELASTICSEARCH_USERNAME && existing.ELASTICSEARCH_USERNAME !== 'elastic')
)
  throw new Error(
    'Search setup supports the local elastic bootstrap account; configure other authentication manually.',
  );
if (existing.ELASTICSEARCH_URL && existing.ELASTICSEARCH_URL !== 'http://127.0.0.1:9200')
  throw new Error('Search setup supports only the local compose endpoint.');
const values = {
  ELASTICSEARCH_URL: 'http://127.0.0.1:9200',
  ELASTICSEARCH_USERNAME: 'elastic',
  ELASTICSEARCH_PASSWORD: randomBytes(32).toString('hex'),
  ELASTICSEARCH_INDEX: 'eventix-events-v1',
};
if (existing.APP_ENV && existing.APP_ENV !== 'development')
  throw new Error('Search setup is limited to local development.');
for (const [key, value] of Object.entries(values))
  if (!existing[key]) content += '\n' + key + '=' + value;
if (content !== readFileSync(path, 'utf8')) writeFileSync(path, content + '\n', 'utf8');
console.log('Local Elasticsearch configuration prepared outside Git; no credentials printed.');
