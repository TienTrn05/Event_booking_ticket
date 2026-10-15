import type { PoolClient } from 'pg';
import { eventParams } from '../catalog/repositories/events.repository.js';
import type { CatalogEvent, EventFilters } from '../catalog/types/catalog.types.js';
import type { SearchCandidate, SearchDocument, SearchQuery } from './search.schema.js';
export const searchFingerprint = (
  s = 's',
  v = 'v',
) => `md5(jsonb_build_object('title',e.title,'displayName',e.display_name,'description',e.description,
  'organizer',o.name,'venue',${v}.name,'city',${v}.city,'category',c.slug,'startsAt',${s}.starts_at,'endsAt',${s}.ends_at)::text)`;
export class SearchRepository {
  async results(
    db: PoolClient,
    q: SearchQuery,
    userId?: string,
    candidates?: SearchCandidate[],
    suggest = false,
  ) {
    const filters: EventFilters = {
      ...q,
      excludedForUserId: userId,
      sort: ['relevance', 'popular'].includes(q.sort)
        ? 'recommended'
        : (q.sort as EventFilters['sort']),
    };
    if (candidates) delete filters.q;
    const built = eventParams(filters);
    const params: unknown[] = [...built.params];
    let select = built.select;
    let rank = 'NULL::integer';
    if (candidates) {
      params.push(JSON.stringify(candidates));
      const pairs = '$' + params.length;
      params.push(candidates.map((c) => c.id));
      const ids = '$' + params.length;
      select = select.replace(
        'AND s2.ends_at>CURRENT_TIMESTAMP',
        `AND s2.ends_at>CURRENT_TIMESTAMP AND EXISTS(
        SELECT 1 FROM jsonb_to_recordset(${pairs}::jsonb) h(id text,hash text) JOIN venues sv ON sv.id=s2.venue_id
        WHERE h.id=s2.id::text AND h.hash=${searchFingerprint('s2', 'sv')})`,
      );
      if (q.sort === 'relevance' || suggest)
        select = select.replace(
          'ORDER BY s2.starts_at, s2.id LIMIT 1',
          `ORDER BY array_position(${ids}::text[],s2.id::text),s2.starts_at,s2.id LIMIT 1`,
        );
      rank = `array_position(${ids}::text[],s.id::text)`;
    }
    select = select.replace(
      'FROM events e',
      `,e.id AS "_id",COALESCE(e.featured_rank,9999) AS "_featured",${rank} AS "_rank",
      (SELECT count(*) FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id JOIN bookings b ON b.id=bi.booking_id
       WHERE b.event_id=e.id AND b.status='CONFIRMED' AND t.status IN ('VALID','USED')) AS "_popular" FROM events e`,
    );
    const order = {
      relevance: candidates ? '"_rank","_id"' : '"_featured","startsAt","_id"',
      popular: '"_popular" DESC,"startsAt","_id"',
      date_asc: '"startsAt","_id"',
      date_desc: '"startsAt" DESC,"_id" DESC',
      price_asc: '"startingPrice"::bigint,"_id"',
      price_desc: '"startingPrice"::bigint DESC,"_id" DESC',
    }[q.sort];
    const result = (
      await db.query<{ items: CatalogEvent[]; total: number }>(
        `WITH matches AS(${select} WHERE ${built.clauses.join(' AND ')}),page AS(
       SELECT * FROM matches ORDER BY ${order} LIMIT ${built.limit} OFFSET ${built.offset})
       SELECT (SELECT count(*)::int FROM matches) AS total,
       COALESCE((SELECT jsonb_agg(to_jsonb(p)-ARRAY['_id','_featured','_rank','_popular'] ORDER BY ${order}) FROM page p),'[]'::jsonb) AS items`,
        params,
      )
    ).rows[0]!;
    return result;
  }
  async projection(db: PoolClient, eventId: string) {
    const version = (
      await db.query<{ version: string }>(
        'SELECT floor(extract(epoch FROM clock_timestamp())*1000000)::bigint::text AS version',
      )
    ).rows[0]!.version;
    const docs = (
      await db.query<
        Omit<SearchDocument, 'completion' | 'version' | 'startsAt' | 'endsAt'> & {
          startsAt: Date;
          endsAt: Date;
        }
      >(
        `SELECT s.id::text,e.id::text AS "eventId",${searchFingerprint()} AS hash,e.title,o.name AS organizer,v.name AS venue,
      e.description,c.slug AS category,v.city,s.starts_at AS "startsAt",s.ends_at AS "endsAt"
      FROM events e JOIN organizations o ON o.id=e.organization_id JOIN event_categories c ON c.id=e.category_id
      JOIN event_sessions s ON s.event_id=e.id JOIN venues v ON v.id=s.venue_id
      WHERE e.id=$1 AND e.status='PUBLISHED' AND o.status='APPROVED' AND e.public_id IS NOT NULL
        AND o.public_id IS NOT NULL AND e.published_at<=clock_timestamp() AND s.status='SCHEDULED' ORDER BY s.id`,
        [eventId],
      )
    ).rows;
    return {
      version,
      documents: docs.map((doc) => ({
        ...doc,
        startsAt: doc.startsAt.toISOString(),
        endsAt: doc.endsAt.toISOString(),
        version,
        completion: { input: [...new Set([doc.title, doc.organizer, doc.venue])].filter(Boolean) },
      })),
    };
  }
  async reserve(db: PoolClient, lease: Buffer) {
    await db.query(`UPDATE outbox_messages SET status=CASE WHEN attempts>=8 THEN 'FAILED' ELSE 'PENDING' END,
      lease_until=NULL,lease_token=NULL WHERE type='SEARCH_EVENT_SYNC' AND status='PROCESSING' AND lease_until<=clock_timestamp()`);
    return (
      await db.query<{ id: string; aggregate_id: string }>(
        `WITH job AS(SELECT id FROM outbox_messages WHERE type='SEARCH_EVENT_SYNC' AND status='PENDING'
       AND available_at<=clock_timestamp() ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
       UPDATE outbox_messages m SET status='PROCESSING',lease_until=clock_timestamp()+interval '1 minute',lease_token=$1,attempts=attempts+1
       FROM job WHERE m.id=job.id RETURNING m.id::text,m.aggregate_id::text`,
        [lease],
      )
    ).rows[0];
  }
  async finish(db: PoolClient, id: string, lease: Buffer, success: boolean) {
    await db.query(
      `UPDATE outbox_messages SET status=CASE WHEN $3 THEN 'DONE' WHEN attempts>=8 THEN 'FAILED' ELSE 'PENDING' END,
      lease_until=NULL,lease_token=NULL,last_error_code=CASE WHEN $3 THEN NULL ELSE 'SEARCH_INDEX_WRITE_FAILED' END,
      available_at=CASE WHEN $3 THEN available_at ELSE clock_timestamp()+least(300,power(2,attempts))*interval '1 second' END
      WHERE id=$1 AND lease_token=$2 AND status='PROCESSING'`,
      [id, lease, success],
    );
  }
  async enqueueAll(db: PoolClient) {
    await db.query('SELECT enqueue_search_event(id) FROM events ORDER BY id');
  }
}
