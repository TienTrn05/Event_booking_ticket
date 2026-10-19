import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  candidatesSchema,
  candidateSchema,
  type SearchCandidate,
  type SearchDocument,
} from './search.schema.js';
import { searchBody, searchMapping } from './search.mapping.js';
const reply = z.object({
  pit_id: z.string().optional(),
  hits: z.object({
    hits: z.array(
      z.object({
        _source: candidateSchema,
        sort: z.array(z.union([z.string(), z.number()])).optional(),
      }),
    ),
  }),
  suggest: z
    .object({
      events: z.array(z.object({ options: z.array(z.object({ _source: candidateSchema })) })),
    })
    .optional(),
});
export interface SearchEngine {
  readonly enabled: boolean;
  candidates(q: string, suggest?: boolean): Promise<SearchCandidate[]>;
  ensure(): Promise<void>;
  ready(): Promise<void>;
  replace(eventId: string, documents: SearchDocument[], version: string): Promise<void>;
  refresh(): Promise<void>;
}
type Settings = Pick<
  typeof env,
  | 'ELASTICSEARCH_URL'
  | 'ELASTICSEARCH_USERNAME'
  | 'ELASTICSEARCH_PASSWORD'
  | 'ELASTICSEARCH_API_KEY'
  | 'ELASTICSEARCH_INDEX'
>;
export class ElasticsearchClient implements SearchEngine {
  readonly enabled: boolean;
  constructor(
    private readonly settings: Settings = env,
    private readonly transport: typeof fetch = fetch,
  ) {
    this.enabled = Boolean(settings.ELASTICSEARCH_URL);
  }
  private async request(path: string, method = 'GET', body?: unknown, accepted = [200]) {
    if (!this.settings.ELASTICSEARCH_URL)
      throw new AppError(503, 'SEARCH_UNAVAILABLE', 'Search is temporarily unavailable.');
    const auth = this.settings.ELASTICSEARCH_API_KEY
      ? 'ApiKey ' + this.settings.ELASTICSEARCH_API_KEY
      : 'Basic ' +
        Buffer.from(
          `${this.settings.ELASTICSEARCH_USERNAME}:${this.settings.ELASTICSEARCH_PASSWORD}`,
        ).toString('base64');
    try {
      const response = await this.transport(new URL(path, this.settings.ELASTICSEARCH_URL), {
        method,
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      });
      if (!accepted.includes(response.status)) throw new Error('Search response failed');
      return {
        status: response.status,
        data:
          method === 'HEAD' || response.status === 404
            ? null
            : ((await response.json()) as unknown),
      };
    } catch {
      throw new AppError(503, 'SEARCH_UNAVAILABLE', 'Search is temporarily unavailable.');
    }
  }
  private get index() {
    return this.settings.ELASTICSEARCH_INDEX;
  }
  async ensure() {
    const head = await this.request('/' + this.index, 'HEAD', undefined, [200, 404]);
    if (head.status === 404) await this.request('/' + this.index, 'PUT', searchMapping, [200, 400]);
    const mapping = await this.request('/' + this.index + '/_mapping');
    const parsed = z
      .record(
        z.string(),
        z.object({
          mappings: z.object({ _meta: z.object({ contract: z.literal('event-search-v1') }) }),
        }),
      )
      .safeParse(mapping.data);
    if (!parsed.success)
      throw new AppError(
        503,
        'SEARCH_SCHEMA_MISMATCH',
        'Search index needs the current application mapping.',
      );
  }
  async ready() {
    await this.request('/' + this.index + '/_count');
  }
  async refresh() {
    await this.request('/' + this.index + '/_refresh', 'POST');
  }
  async candidates(q: string, suggest = false) {
    if (suggest) {
      const data = reply.parse(
        (await this.request('/' + this.index + '/_search', 'POST', searchBody(q, true))).data,
      );
      const candidates = [
        ...(data.suggest?.events.flatMap((e) => e.options.map((o) => o._source)) ?? []),
        ...data.hits.hits.map((h) => h._source),
      ];
      return candidatesSchema.parse([...new Map(candidates.map((c) => [c.id, c])).values()]);
    }
    let pit = z
      .object({ id: z.string() })
      .parse((await this.request('/' + this.index + '/_pit?keep_alive=1m', 'POST')).data).id;
    try {
      const all: SearchCandidate[] = [];
      let after: (number | string)[] | undefined;
      for (;;) {
        const data = reply.parse(
          (
            await this.request('/_search', 'POST', {
              ...searchBody(q),
              pit: { id: pit, keep_alive: '1m' },
              ...(after ? { search_after: after } : {}),
            })
          ).data,
        );
        pit = data.pit_id ?? pit;
        all.push(...data.hits.hits.map((h) => h._source));
        if (all.length > 10000)
          throw new AppError(422, 'SEARCH_TOO_BROAD', 'Please narrow your search.');
        if (data.hits.hits.length < 500) return candidatesSchema.parse(all);
        after = data.hits.hits.at(-1)!.sort;
        if (!after)
          throw new AppError(503, 'SEARCH_UNAVAILABLE', 'Search is temporarily unavailable.');
      }
    } finally {
      await this.request('/_pit', 'DELETE', { id: pit }).catch(() => undefined);
    }
  }
  async replace(eventId: string, documents: SearchDocument[], version: string) {
    for (const doc of documents)
      await this.request(
        '/' + this.index + '/_doc/' + doc.id + '?version=' + version + '&version_type=external_gte',
        'PUT',
        doc,
        [200, 201, 409],
      );
    const result = await this.request(
      '/' + this.index + '/_delete_by_query?conflicts=proceed&refresh=true',
      'POST',
      {
        query: {
          bool: {
            filter: [{ term: { eventId } }],
            ...(documents.length
              ? { must_not: [{ terms: { id: documents.map((d) => d.id) } }] }
              : {}),
          },
        },
      },
    );
    if (
      !z
        .object({ timed_out: z.literal(false), failures: z.array(z.unknown()).length(0) })
        .safeParse(result.data).success
    )
      throw new AppError(503, 'SEARCH_UNAVAILABLE', 'Search is temporarily unavailable.');
  }
}
