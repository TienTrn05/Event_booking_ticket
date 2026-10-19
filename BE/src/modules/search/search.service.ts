import { createHash, randomBytes } from 'node:crypto';
import { withConnection } from '../../shared/database/pool.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { redisCommand } from '../../shared/redis/client.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { usersRepository } from '../users/repositories/users.repository.js';
import type { RequestActor } from '../../shared/auth/request-actor.js';
import { ElasticsearchClient, type SearchEngine } from './search.client.js';
import { SearchRepository } from './search.repository.js';
import { candidatesSchema, type SearchCandidate, type SearchQuery } from './search.schema.js';
export class SearchService {
  constructor(
    private readonly engine: SearchEngine = new ElasticsearchClient(),
    private readonly repository = new SearchRepository(),
    private readonly cache: (args: string[]) => Promise<unknown> = redisCommand,
    private readonly cacheEnabled = Boolean(env.REDIS_URL),
  ) {}
  private async candidates(q: string, suggest: boolean) {
    const key =
      `${env.REDIS_PREFIX}:event-search:${env.ELASTICSEARCH_INDEX}:` +
      createHash('sha256')
        .update(JSON.stringify([q.toLowerCase(), suggest]))
        .digest('hex');
    if (this.cacheEnabled)
      try {
        const cached = await this.cache(['GET', key]);
        if (typeof cached === 'string' && cached.length < 1048576)
          return candidatesSchema.parse(JSON.parse(cached));
      } catch {
        /* Search works without cache. */
      }
    const candidates = await this.engine.candidates(q, suggest);
    if (this.cacheEnabled)
      try {
        await this.cache(['SET', key, JSON.stringify(candidates), 'EX', '15']);
      } catch {
        /* Cache does not control correctness. */
      }
    return candidates;
  }
  async search(q: SearchQuery, actor?: RequestActor, suggest = false) {
    let candidates: SearchCandidate[] | undefined,
      degraded = false;
    if (q.q && this.engine.enabled)
      try {
        candidates = await this.candidates(q.q, suggest);
      } catch (error) {
        if (error instanceof AppError && error.code === 'SEARCH_TOO_BROAD') throw error;
        degraded = true;
      }
    const result = await withConnection(async (db) => {
      if (actor) await usersRepository.profile(db, actor);
      return this.repository.results(db, q, actor?.id, candidates, suggest);
    });
    return {
      ...result,
      degraded,
      engine: q.q && candidates ? 'elasticsearch' : 'postgresql',
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / q.pageSize),
        hasMore: q.page * q.pageSize < result.total,
      },
    };
  }
}
export class SearchIndexer {
  private initialized = false;
  constructor(
    private readonly engine: SearchEngine = new ElasticsearchClient(),
    private readonly repository = new SearchRepository(),
  ) {}
  async recover() {
    if (!this.engine.enabled) return false;
    if (!this.initialized) {
      await this.engine.ensure();
      this.initialized = true;
    }
    const lease = randomBytes(32),
      job = await withTransaction((db) => this.repository.reserve(db, lease));
    if (!job) return false;
    try {
      const projection = await withConnection((db) =>
        this.repository.projection(db, job.aggregate_id),
      );
      await this.engine.replace(job.aggregate_id, projection.documents, projection.version);
      await withTransaction((db) => this.repository.finish(db, job.id, lease, true));
    } catch (error) {
      await withTransaction((db) => this.repository.finish(db, job.id, lease, false));
      throw error;
    }
    return true;
  }
  async reindex() {
    await this.engine.ensure();
    this.initialized = true;
    await withTransaction((db) => this.repository.enqueueAll(db));
    while (await this.recover()) {
      /* Bounded one-event network work per transaction. */
    }
    await this.engine.refresh();
  }
}
