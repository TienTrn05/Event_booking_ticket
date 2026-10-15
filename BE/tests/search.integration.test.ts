import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { pool, withConnection, checkDatabase } from '../src/shared/database/pool.js';
import { withTransaction } from '../src/shared/database/transaction.js';
import { env } from '../src/config/env.js';
import { ElasticsearchClient } from '../src/modules/search/search.client.js';
import { SearchService, SearchIndexer } from '../src/modules/search/search.service.js';
import { SearchRepository } from '../src/modules/search/search.repository.js';
import { searchQuery } from '../src/modules/search/search.schema.js';
import { postgresCatalogRepository as catalog } from '../src/modules/catalog/catalog.repository.js';
import { createApp } from '../src/app.js';
import { createSearchRouter } from '../src/modules/search/search.routes.js';
import express from 'express';
import { errorHandler } from '../src/shared/middleware/error-handler.js';
import { authenticatedUser, accessToken } from '../src/modules/auth/session/session.service.js';
import type { RequestActor } from '../src/shared/auth/request-actor.js';
import { runCommerceBrowser } from './fixtures/commerce-browser.js';
const settings = {
  ...env,
  ELASTICSEARCH_URL: process.env.SEARCH_TEST_URL,
  ELASTICSEARCH_API_KEY: process.env.SEARCH_TEST_KEY,
  ELASTICSEARCH_USERNAME: undefined,
  ELASTICSEARCH_PASSWORD: undefined,
  ELASTICSEARCH_INDEX: process.env.SEARCH_TEST_INDEX ?? 'eventix-search-fixture-disabled',
};
const engine = new ElasticsearchClient(settings),
  repository = new SearchRepository();
const search = new SearchService(engine, repository, undefined, false),
  indexer = new SearchIndexer(engine);
let eventId: string, publicId: string, orgId: string, venueId: string;
let original: Record<string, unknown>, originalOrg: string, originalVenue: string;
async function drain() {
  let count = 0;
  while (await indexer.recover()) {
    if (++count > 1000) throw new Error('Search fixture queue did not settle.');
  }
  await engine.refresh();
}
async function buyer(): Promise<RequestActor> {
  const user = (
    await pool.query<{ id: string }>(
      "INSERT INTO users(display_name,gender,date_of_birth,registration_role,onboarding_completed_at) VALUES('Search fixture','UNDISCLOSED','1990-01-02','CUSTOMER',now()) RETURNING id::text",
    )
  ).rows[0]!;
  const identity = (
    await pool.query<{ id: string }>(
      "INSERT INTO external_identities(user_id,provider,subject,email_canonical,email_verified_at,verified_at) VALUES($1,'EMAIL',$2,$2,now(),now()) RETURNING id::text",
      [user.id, randomUUID() + '@fixture.invalid'],
    )
  ).rows[0]!;
  await pool.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='CUSTOMER'",
    [user.id],
  );
  const session = (
    await pool.query<{ id: string }>(
      "INSERT INTO auth_sessions(user_id,identity_id,authenticated_at,family_id,expires_at) VALUES($1,$2,now(),$3,now()+interval '7 days') RETURNING id::text",
      [user.id, identity.id, randomBytes(32)],
    )
  ).rows[0]!;
  return { id: user.id, sessionId: session.id, authVersion: 0 };
}
describe.skipIf(!process.env.COMMERCE_TEST_DB_PORT || !process.env.SEARCH_TEST_KEY)(
  'event search against real PostgreSQL/Elasticsearch',
  () => {
    beforeAll(async () => {
      await pool.query(
        "UPDATE outbox_messages SET status='DONE',lease_until=NULL,lease_token=NULL WHERE type='SEARCH_EVENT_SYNC'",
      );
      original = (
        await pool.query(`SELECT e.id::text,e.public_id,e.title,e.display_name,e.description,e.status,e.organization_id::text,s.id::text AS session_id,s.venue_id::text,o.name AS org_name,v.name AS venue_name
    FROM events e JOIN organizations o ON o.id=e.organization_id JOIN event_sessions s ON s.event_id=e.id JOIN venues v ON v.id=s.venue_id
    WHERE e.status='PUBLISHED' AND s.status='SCHEDULED' AND s.ends_at>now() ORDER BY e.id,s.id LIMIT 1`)
      ).rows[0];
      eventId = original.id as string;
      publicId = original.public_id as string;
      orgId = original.organization_id as string;
      venueId = original.venue_id as string;
      originalOrg = original.org_name as string;
      originalVenue = original.venue_name as string;
      await pool.query(
        "UPDATE events SET title='Galaxy Jazz Night',display_name='Galaxy Jazz Night',description='Live jazz performances under the stars' WHERE id=$1",
        [eventId],
      );
      await pool.query("UPDATE organizations SET name='Aurora Concerts' WHERE id=$1", [orgId]);
      await pool.query("UPDATE venues SET name='Harbor Theatre' WHERE id=$1", [venueId]);
      await engine.ensure();
      await drain();
    }, 60000);
    afterAll(async () => {
      if (original) {
        await pool.query(
          'UPDATE events SET title=$2,display_name=$3,description=$4,status=$5 WHERE id=$1',
          [eventId, original.title, original.display_name, original.description, original.status],
        );
        await pool.query('UPDATE organizations SET name=$2 WHERE id=$1', [orgId, originalOrg]);
        await pool.query('UPDATE venues SET name=$2 WHERE id=$1', [venueId, originalVenue]);
      }
      await pool.end();
    });
    it('finds title, Organizer, venue, typos and prefix suggestions with current pagination', async () => {
      for (const q of ['Galaxy', 'galaxi', 'Aurora', 'Harbor']) {
        const result = await search.search(searchQuery.parse({ q }));
        expect(result.engine).toBe('elasticsearch');
        expect(result.items.some((item) => item.id === publicId)).toBe(true);
      }
      const suggestions = await search.search(
        searchQuery.parse({ q: 'Gala', pageSize: '6' }),
        undefined,
        true,
      );
      expect(suggestions.items.some((item) => item.id === publicId)).toBe(true);
      const all = await search.search(searchQuery.parse({ q: 'Galaxy', pageSize: '1' }));
      expect(all.items).toHaveLength(1);
      expect(all.pagination.total).toBe(all.total);
    });
    it('uses PostgreSQL for live filters, blocks, removed events and stale cached text hashes', async () => {
      const candidates = await engine.candidates('Galaxy');
      let cachedValue: string | null = JSON.stringify(candidates);
      const cache = async (args: string[]) =>
        args[0] === 'GET' ? cachedValue : ((cachedValue = args[2]!), 'OK');
      const cachedSearch = new SearchService(engine, repository, cache, true),
        actor = await buyer();
      await pool.query('INSERT INTO organization_blocks(user_id,organization_id) VALUES($1,$2)', [
        actor.id,
        orgId,
      ]);
      expect(
        (await cachedSearch.search(searchQuery.parse({ q: 'Galaxy' }), actor)).items.some(
          (e) => e.id === publicId,
        ),
      ).toBe(false);
      expect(
        (await cachedSearch.search(searchQuery.parse({ q: 'Galaxy' }))).items.some(
          (e) => e.id === publicId,
        ),
      ).toBe(true);
      expect(
        (await cachedSearch.search(searchQuery.parse({ q: 'Galaxy', maxPrice: '1' }))).items,
      ).toHaveLength(0);
      await pool.query("UPDATE events SET title='Nebula Blues Evening' WHERE id=$1", [eventId]);
      expect(
        (await cachedSearch.search(searchQuery.parse({ q: 'Galaxy' }))).items.some(
          (e) => e.id === publicId,
        ),
      ).toBe(false);
      await drain();
      expect(
        (await search.search(searchQuery.parse({ q: 'Nebula' }))).items.some(
          (e) => e.id === publicId,
        ),
      ).toBe(true);
      await pool.query("UPDATE events SET status='ARCHIVED' WHERE id=$1", [eventId]);
      expect(
        (await search.search(searchQuery.parse({ q: 'Nebula' }))).items.some(
          (e) => e.id === publicId,
        ),
      ).toBe(false);
      await drain();
      expect(await engine.candidates('Nebula')).toHaveLength(0);
      await pool.query(
        "UPDATE events SET status='PUBLISHED',title='Galaxy Jazz Night' WHERE id=$1",
        [eventId],
      );
      await drain();
    });
    it('retains a failed indexing job for retry without leaking private drafts to the engine', async () => {
      const failing = {
        ...engine,
        enabled: true,
        ensure: async () => {},
        ready: async () => {},
        candidates: async () => [],
        refresh: async () => {},
        replace: async () => {
          throw new Error('Fixture timeout');
        },
      };
      await pool.query(
        "UPDATE outbox_messages SET status='DONE',lease_until=NULL,lease_token=NULL WHERE type='SEARCH_EVENT_SYNC'",
      );
      await withTransaction((db) => repository.enqueueAll(db));
      await expect(new SearchIndexer(failing).recover()).rejects.toThrow('Fixture timeout');
      const job = (
        await pool.query(
          "SELECT status,attempts,last_error_code FROM outbox_messages WHERE type='SEARCH_EVENT_SYNC' AND status='PENDING' ORDER BY id LIMIT 1",
        )
      ).rows[0];
      expect(job).toMatchObject({
        status: 'PENDING',
        attempts: 1,
        last_error_code: 'SEARCH_INDEX_WRITE_FAILED',
      });
      const draft = (
        await pool.query<{ id: string }>("SELECT id::text FROM events WHERE status='DRAFT' LIMIT 1")
      ).rows[0];
      if (draft)
        expect(
          (await withConnection((db) => repository.projection(db, draft.id))).documents,
        ).toHaveLength(0);
      await pool.query(
        "UPDATE outbox_messages SET available_at=now() WHERE type='SEARCH_EVENT_SYNC' AND status='PENDING'",
      );
      await drain();
    });
    it('exposes search HTTP safely and falls back to PostgreSQL when the index is unavailable', async () => {
      const app = express();
      app.use('/api/v1', createSearchRouter(search));
      app.use(errorHandler);
      expect(
        (
          await request(app).get('/api/v1/search/events').query({ q: 'Galaxy' })
        ).body.data.items.some((e: { id: string }) => e.id === publicId),
      ).toBe(true);
      expect(
        (await request(app).get('/api/v1/search/events').query({ q: 'Galaxy', userId: '1' }))
          .status,
      ).toBe(400);
      expect(
        (await request(app).get('/api/v1/search/events').set('Authorization', 'Bearer invalid'))
          .status,
      ).toBe(401);
      const failed = {
        ...engine,
        enabled: true,
        ensure: async () => {},
        ready: async () => {},
        candidates: async () => {
          throw new Error('Fixture offline');
        },
        refresh: async () => {},
        replace: async () => {},
      };
      const fallback = await new SearchService(failed, repository, undefined, false).search(
        searchQuery.parse({ q: 'Galaxy' }),
      );
      expect(fallback.degraded).toBe(true);
      expect(fallback.items.some((e) => e.id === publicId)).toBe(true);
      const actor = await buyer(),
        token = await accessToken({
          userId: actor.id,
          sessionId: actor.sessionId,
          authVersion: 0,
          identityId: '1',
          displayName: 'Fixture',
          expiresAt: new Date(Date.now() + 86400000),
          refreshToken: '',
        });
      expect((await authenticatedUser('Bearer ' + token)).id).toBe(actor.id);
      // Production app mounts these same routes with the normal guards and OpenAPI.
      expect(
        (
          await request(createApp({ catalogRepository: catalog, checkDatabase })).get(
            '/api/v1/openapi.json',
          )
        ).body.paths['/search/events'],
      ).toBeDefined();
    });
    it.skipIf(process.env.SEARCH_TEST_BROWSER !== '1')(
      'Home searches the server and opens results outside the initial catalog',
      async () => {
        const app = express();
        let failNextSearch = false;
        app.get('/api/v1/search/events', (_req, res, next) => {
          if (failNextSearch) {
            failNextSearch = false;
            res.status(503).json({ error: { code: 'FIXTURE_OFFLINE' } });
          } else next();
        });
        app.use('/api/v1', createSearchRouter(search));
        app.use(
          createApp({
            catalogRepository: {
              ...catalog,
              listEvents: async (filters) =>
                (await catalog.listEvents(filters)).filter((e) => e.id !== publicId),
            },
            checkDatabase,
          }),
        );
        app.use(errorHandler);
        await runCommerceBrowser({
          app,
          origin: env.PUBLIC_APP_URL!,
          run: async (browser) => {
            await browser.send('Page.navigate', { url: env.PUBLIC_APP_URL + '/#discover' });
            await browser.until(
              '!!document.querySelector(\'#discover input[aria-label="Search events"]\')',
            );
            await browser.evaluate(
              "Array.from(document.querySelectorAll('#discover button')).find(b=>b.textContent.trim()==='Filters').click();true",
            );
            await browser.until(
              "Array.from(document.querySelectorAll('#discover button')).some(b=>b.textContent==='All')",
            );
            await browser.evaluate(
              "Array.from(document.querySelectorAll('#discover button')).find(b=>b.textContent==='All').click();true",
            );
            async function type(value: string) {
              await browser.evaluate(
                `(()=>{const e=document.querySelector('#discover input');e.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`,
              );
            }
            await type('Gala');
            await browser.until(
              "document.querySelector('#event-search-suggestions')?.textContent.includes('Galaxy Jazz Night')&&document.querySelector('#discover article')?.textContent.includes('Galaxy Jazz Night')",
            );
            await browser.send('Input.dispatchKeyEvent', {
              type: 'keyDown',
              key: 'ArrowDown',
              code: 'ArrowDown',
              windowsVirtualKeyCode: 40,
            });
            await browser.send('Input.dispatchKeyEvent', {
              type: 'keyDown',
              key: 'Enter',
              code: 'Enter',
              windowsVirtualKeyCode: 13,
            });
            await browser.until(
              "document.querySelector('#quick-preview-title')?.textContent==='Galaxy Jazz Night'",
            );
            await browser.evaluate(
              'document.querySelector(\'button[aria-label="Close preview"]\').click();true',
            );
            await type('galaxi');
            await browser.until(
              "!document.querySelector('#discover')?.textContent.includes('Searching')&&document.querySelector('#discover article')?.textContent.includes('Galaxy Jazz Night')",
            );
            await type('NoSuchEvent987654321');
            await browser.until(
              "document.querySelector('#discover')?.textContent.includes('No events match your filters')",
            );
            await type('');
            await browser.until(
              "Array.from(document.querySelectorAll('#discover button')).some(b=>b.textContent.includes('Load more events')&&!b.disabled)",
            );
            const before = await browser.evaluate(
              "document.querySelectorAll('#discover article').length",
            );
            await browser.evaluate(
              "Array.from(document.querySelectorAll('#discover button')).find(b=>b.textContent.includes('Load more events')).click();true",
            );
            await browser.until(`document.querySelectorAll('#discover article').length>${before}`);
            failNextSearch = true;
            await type('Galaxy');
            await browser.until(
              "document.querySelector('#discover [role=alert]')?.textContent.includes('Could not load events')",
            );
            await browser.evaluate(
              "Array.from(document.querySelectorAll('#discover button')).find(b=>b.textContent==='Retry search').click();true",
            );
            await browser.until(
              "document.querySelector('#discover article')?.textContent.includes('Galaxy Jazz Night')",
            );
            await pool.query("UPDATE events SET status='ARCHIVED' WHERE id=$1", [eventId]);
            await browser.evaluate("document.querySelector('#discover article').click();true");
            await browser.until(
              "document.querySelector('[role=dialog]')?.textContent.includes('This event is no longer available.')",
            );
            await pool.query("UPDATE events SET status='PUBLISHED' WHERE id=$1", [eventId]);
            await drain();
          },
        });
      },
      60000,
    );
  },
);
