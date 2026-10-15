import { describe, expect, it, vi } from 'vitest';
import { searchQuery } from '../src/modules/search/search.schema.js';
import { ElasticsearchClient } from '../src/modules/search/search.client.js';
import { searchBody, searchMapping } from '../src/modules/search/search.mapping.js';
import { env } from '../src/config/env.js';
import { parseEnv } from '../src/config/env.schema.js';
describe('event search boundary and engine policy', () => {
  it('requires backend-only authentication and HTTPS outside local development', () => {
    const settings = {
      ...process.env,
      ELASTICSEARCH_URL: 'http://127.0.0.1:9200',
      ELASTICSEARCH_USERNAME: 'fixture',
      ELASTICSEARCH_PASSWORD: 'fixture-only',
    };
    expect(parseEnv(settings).ELASTICSEARCH_INDEX).toBe('eventix-events-v1');
    expect(() => parseEnv({ ...settings, ELASTICSEARCH_PASSWORD: undefined })).toThrow(
      'Invalid Elasticsearch credentials.',
    );
    expect(() => parseEnv({ ...settings, ELASTICSEARCH_API_KEY: 'fixture-key' })).toThrow(
      'Invalid Elasticsearch credentials.',
    );
    expect(() =>
      parseEnv({ ...settings, ELASTICSEARCH_URL: 'http://remote.invalid:9200' }),
    ).toThrow('Elasticsearch requires HTTPS');
    expect(() =>
      parseEnv({ ...settings, ELASTICSEARCH_URL: 'https://fixture:private@remote.invalid' }),
    ).toThrow('Invalid Elasticsearch endpoint.');
  });
  it('rejects client identity/DSL, repeated filters, invalid ranges and unsupported sorts', () => {
    for (const value of [
      { userId: '1' },
      { query: { match_all: {} } },
      { q: ['a', 'b'] },
      { sort: '_script' },
      { minPrice: '30', maxPrice: '20' },
      { from: '2026-12-01T00:00:00Z', to: '2026-11-01T00:00:00Z' },
      { maxPrice: '9223372036854775808' },
    ])
      expect(searchQuery.safeParse(value).success).toBe(false);
    expect(searchQuery.parse({ q: ' jazz ', sort: 'popular' })).toMatchObject({
      q: 'jazz',
      sort: 'popular',
      page: 1,
      pageSize: 20,
    });
  });
  it('keeps one shard/no replicas and English prefix/N-gram/completion analysis', () => {
    expect(searchMapping.settings.number_of_shards).toBe(1);
    expect(searchMapping.settings.number_of_replicas).toBe(0);
    expect(searchMapping.mappings.properties.title.analyzer).toBe('english');
    expect(searchMapping.mappings.properties.completion.type).toBe('completion');
    expect(JSON.stringify(searchBody('jazz'))).not.toContain('query_string');
    expect(searchBody('jaz', true).suggest?.events.prefix).toBe('jaz');
  });
  it('does not expose endpoint credentials or provider payload when Elasticsearch fails', async () => {
    const transport = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ error: 'private fixture provider detail' }), { status: 401 }),
    );
    const client = new ElasticsearchClient(
      {
        ...env,
        ELASTICSEARCH_URL: 'http://127.0.0.1:9200',
        ELASTICSEARCH_USERNAME: 'fixture',
        ELASTICSEARCH_PASSWORD: 'fixture-only',
      },
      transport,
    );
    await expect(client.ready()).rejects.toMatchObject({
      code: 'SEARCH_UNAVAILABLE',
      message: 'Search is temporarily unavailable.',
    });
  });
});
