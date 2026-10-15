import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { publicSeats } from '../src/modules/bookings/inventory/inventory.service.js';
import { inbox } from '../src/modules/notifications/services/notifications.service.js';
import request from 'supertest';
import { pool, checkDatabase } from '../src/shared/database/pool.js';
import { withTransaction } from '../src/shared/database/transaction.js';
import {
  createSession,
  accessToken,
  authenticatedUser,
  listSessions,
  revokeOwnedSession,
  logoutAll,
  rotateRefresh,
} from '../src/modules/auth/session/session.service.js';
import type { RequestActor } from '../src/shared/auth/request-actor.js';
import type { Session } from '../src/modules/auth/shared/auth.types.js';
import { EventManagementService } from '../src/modules/events/management/event-management.service.js';
import {
  draftInput,
  layoutInput,
  sessionInput,
  pricingInput,
} from '../src/modules/events/management/event-management.schema.js';
import { OrganizationService } from '../src/modules/organizations/application/organization.service.js';
import { OrganizerBlockService } from '../src/modules/users/blocks/organizer-block.service.js';
import { postgresCatalogRepository as catalog } from '../src/modules/catalog/catalog.repository.js';
import { RecommendationService } from '../src/modules/catalog/recommendations/recommendation.service.js';
import { SupportReportService } from '../src/modules/support-reports/support-report.service.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { auditQuery } from '../src/modules/audit/audit.schema.js';
import { reportQuery } from '../src/modules/support-reports/support-report.schema.js';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createHold } from '../src/modules/bookings/holds/hold.service.js';
import { releaseHold } from '../src/modules/bookings/holds/hold.service.js';
import { createBooking } from '../src/modules/bookings/orders/booking-command.service.js';
import { saveAttendees } from '../src/modules/tickets/attendees/attendee.service.js';
import { attendeesInput } from '../src/modules/tickets/attendees/attendee.schema.js';
import { PaymentService } from '../src/modules/payments/application/payment.service.js';
import { BookingPaymentAdapter } from '../src/modules/bookings/payments/booking-payment.adapter.js';
import { DatabaseTicketIssuer } from '../src/modules/tickets/issuance/ticket-issuer.js';
import { TicketService } from '../src/modules/tickets/application/ticket.service.js';
import type {
  PaymentGateway,
  PaymentLink,
} from '../src/modules/payments/application/payment.ports.js';

async function account(role: 'CUSTOMER' | 'ORGANIZER' | 'ADMIN' = 'CUSTOMER') {
  const user = (
    await pool.query<{ id: string }>(
      `INSERT INTO users(display_name,gender,date_of_birth,registration_role,onboarding_completed_at)
    VALUES('Completion fixture','UNDISCLOSED','1990-01-02',$1,now()) RETURNING id::text`,
      [role === 'ADMIN' ? 'CUSTOMER' : role],
    )
  ).rows[0]!;
  const identity = (
    await pool.query<{ id: string }>(
      `INSERT INTO external_identities(user_id,provider,subject,email_canonical,email_verified_at,verified_at)
    VALUES($1,'EMAIL',$2,$2,now(),now()) RETURNING id::text`,
      [user.id, randomUUID() + '@fixture.invalid'],
    )
  ).rows[0]!;
  await pool.query(
    'INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code=$2',
    [user.id, role],
  );
  const session = await withTransaction((db) =>
    createSession(
      db,
      {
        userId: user.id,
        identityId: identity.id,
        displayName: 'Completion fixture',
        authVersion: 0,
      },
      randomUUID(),
    ),
  );
  return {
    actor: { id: user.id, sessionId: session.sessionId, authVersion: 0 } satisfies RequestActor,
    session,
  };
}
async function anotherSession(session: Session) {
  return withTransaction((db) => createSession(db, session, randomUUID()));
}
const management = new EventManagementService(),
  reports = new SupportReportService(),
  blocks = new OrganizerBlockService();
let organizer: RequestActor,
  buyer: RequestActor,
  admin: RequestActor,
  outsider: RequestActor,
  organizationId: string,
  eventId: string,
  publicId: string,
  organizerPublicId: string,
  sessionId: string,
  otherSessionId: string;
let start: Date, otherStart: Date;
async function draft(title: string) {
  return management.create(
    organizer,
    draftInput.parse({ organizationId, title, categoryId: '1', description: 'Completion fixture' }),
    randomUUID(),
    randomUUID(),
  );
}
async function reviewFixture(expired: boolean) {
  const graph = await draft('Reason ' + randomUUID());
  const id = graph.event!.id;
  const review = (
    await pool.query<{ id: string }>(
      `INSERT INTO event_reviews(event_id,event_version,submitted_by,submitted_at,expires_at,earliest_session_starts_at,submission_cutoff_at,calendar_timezone,snapshot_json)
    VALUES($1,0,$2,now()-interval '16 days',now()-interval '1 day',now()+interval '60 days',now()+interval '1 day','Asia/Ho_Chi_Minh','{}') RETURNING id::text`,
      [id, organizer.id],
    )
  ).rows[0]!;
  if (!expired)
    await pool.query(
      "UPDATE event_reviews SET submitted_at=now(),expires_at=now()+interval '15 days' WHERE id=$1",
      [review.id],
    );
  await pool.query("UPDATE events SET status='PENDING_REVIEW' WHERE id=$1", [id]);
  if (expired) await management.expire();
  return { eventId: id, reviewId: review.id };
}
async function token(actor: RequestActor) {
  return (
    'Bearer ' +
    (await accessToken({
      userId: actor.id,
      sessionId: actor.sessionId,
      authVersion: actor.authVersion,
      displayName: 'Fixture',
      identityId: '1',
      expiresAt: new Date(Date.now() + 86400000),
      refreshToken: '',
    }))
  );
}
describe.skipIf(!process.env.COMMERCE_TEST_DB_PORT)(
  'backend completion on isolated PostgreSQL',
  () => {
    afterAll(async () => pool.end());
    beforeAll(async () => {
      organizer = (await account('ORGANIZER')).actor;
      buyer = (await account()).actor;
      outsider = (await account()).actor;
      admin = (await account('ADMIN')).actor;
      const organization = (await new OrganizationService().apply(
        organizer,
        { name: 'Completion organization' },
        randomUUID(),
        randomUUID(),
      ))!;
      organizationId = organization.id;
      await new OrganizationService().decide(
        admin,
        organization.id,
        true,
        { version: organization.version, reason: 'Fixture' },
        randomUUID(),
        randomUUID(),
      );
      let graph = await draft('Completion ' + randomUUID());
      eventId = graph.event!.id;
      const layout = layoutInput.parse({
        version: 0,
        venueId: '904001',
        seats: [1, 2, 3].map((n) => ({
          section: 'Main',
          row: 'A',
          number: String(n),
          x: n * 3,
          y: 3,
          width: 1,
          height: 1,
        })),
      });
      graph = await management.configure(
        organizer,
        eventId,
        'layout',
        layout,
        0,
        randomUUID(),
        randomUUID(),
      );
      const epoch = Math.floor(Date.now() / 1000) * 1000,
        iso = (days: number) => new Date(epoch + days * 86400000).toISOString();
      for (let i = 0; i < 2; i++) {
        const input = sessionInput.parse({
          version: graph.event!.version,
          layoutId: graph.layouts[0]!.id,
          startsAt: iso(60 + i * 10),
          endsAt: iso(61 + i * 10),
          saleOpensAt: iso(-1),
          saleClosesAt: iso(59 + i * 10),
          counterOpensAt: iso(-1),
          counterClosesAt: iso(60 + i * 10),
          admissionOpensAt: iso(-1),
          admissionClosesAt: iso(61 + i * 10),
        });
        graph = await management.configure(
          organizer,
          eventId,
          'session',
          input,
          input.version,
          randomUUID(),
          randomUUID(),
        );
        const sid = graph.sessions[i]!.id;
        if (i === 0) sessionId = sid;
        else otherSessionId = sid;
        graph = await management.configure(
          organizer,
          eventId,
          'type',
          { version: graph.event!.version, code: 'STANDARD', name: 'Standard' },
          graph.event!.version,
          randomUUID(),
          randomUUID(),
          sid,
        );
        const tt = (
          await pool.query<{ id: string }>(
            'SELECT id::text FROM ticket_types WHERE session_id=$1',
            [sid],
          )
        ).rows[0]!.id;
        const pricing = pricingInput.parse({
          version: graph.event!.version,
          prices: graph.seats.map((s) => ({
            seatId: s.id,
            ticketTypeId: tt,
            priceMinor: i === 0 ? '9000' : '2000',
            currency: 'VND',
          })),
        });
        graph = await management.configure(
          organizer,
          eventId,
          'prices',
          pricing,
          pricing.version,
          randomUUID(),
          randomUUID(),
          sid,
        );
      }
      await pool.query(
        "UPDATE events SET cover_image_url='https://images.fixture.invalid/completion.png' WHERE id=$1",
        [eventId],
      );
      graph = await management.submit(
        organizer,
        eventId,
        graph.event!.version,
        randomUUID(),
        randomUUID(),
      );
      await management.decide(
        admin,
        graph.reviews[0]!.id,
        'APPROVED',
        { version: graph.event!.version, reason: 'Fixture' },
        randomUUID(),
        randomUUID(),
      );
      const row = (
        await pool.query<{ public_id: string; org: string }>(
          'SELECT e.public_id,o.public_id AS org FROM events e JOIN organizations o ON o.id=e.organization_id WHERE e.id=$1',
          [eventId],
        )
      ).rows[0]!;
      publicId = row.public_id;
      organizerPublicId = row.org;
      start = (
        await pool.query<{ starts_at: Date }>('SELECT starts_at FROM event_sessions WHERE id=$1', [
          sessionId,
        ])
      ).rows[0]!.starts_at;
      otherStart = (
        await pool.query<{ starts_at: Date }>('SELECT starts_at FROM event_sessions WHERE id=$1', [
          otherSessionId,
        ])
      ).rows[0]!.starts_at;
    }, 20000);
    it('lists only owned live sessions, revokes one device and serializes logout-all with refresh', async () => {
      const user = await account(),
        other = await account(),
        second = await anotherSession(user.session),
        third = await anotherSession(user.session);
      const rows = await listSessions(user.actor, 1, 100);
      expect(rows.items).toHaveLength(3);
      expect(JSON.stringify(rows)).not.toMatch(/family|tokenHash|refreshToken|subject|email/);
      await expect(
        revokeOwnedSession(user.actor, other.actor.sessionId, randomUUID()),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await revokeOwnedSession(user.actor, second.sessionId, randomUUID());
      await revokeOwnedSession(user.actor, second.sessionId, randomUUID());
      await expect(rotateRefresh(second.refreshToken, randomUUID())).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
      expect(await authenticatedUser(await token(user.actor))).toMatchObject({ id: user.actor.id });
      const access = await token(user.actor);
      const race = await Promise.allSettled([
        rotateRefresh(third.refreshToken, randomUUID()),
        logoutAll(user.actor, randomUUID()),
      ]);
      expect(race[1]!.status).toBe('fulfilled');
      await expect(authenticatedUser(access)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      await expect(rotateRefresh(user.session.refreshToken, randomUUID())).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
      const active = (
        await pool.query(
          'SELECT count(*)::int n FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL',
          [user.actor.id],
        )
      ).rows[0].n;
      expect(active).toBe(0);
    });
    it('requires Origin/CSRF for session revocation and clears the current refresh cookie', async () => {
      const user = await account(),
        app = createApp({ catalogRepository: catalog, checkDatabase }),
        bearer = await token(user.actor);
      expect(
        (await request(app).get('/api/v1/auth/sessions').set('Authorization', bearer)).body.data
          .items,
      ).toHaveLength(1);
      expect(
        (await request(app).post('/api/v1/auth/logout-all').set('Authorization', bearer).send({}))
          .status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post('/api/v1/auth/logout-all')
            .set('Authorization', bearer)
            .set('Origin', env.PUBLIC_APP_URL!)
            .set('Cookie', 'eventix.csrf=proof')
            .set('X-CSRF-Token', 'wrong')
            .send({})
        ).status,
      ).toBe(403);
      const response = await request(app)
        .delete('/api/v1/auth/sessions/' + user.actor.sessionId)
        .set('Authorization', bearer)
        .set('Origin', env.PUBLIC_APP_URL!)
        .set('Cookie', 'eventix.csrf=proof')
        .set('X-CSRF-Token', 'proof');
      expect(response.status).toBe(204);
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('eventix.refresh=;')]),
      );
    });
    it('filters price/date/availability on the same session and uses exclusive upper date bounds', async () => {
      const q = { page: 1, pageSize: 100, q: 'Completion ' };
      const dayAfter = new Date(start.getTime() + 86400000).toISOString();
      expect(
        (
          await catalog.listEvents({
            ...q,
            from: start.toISOString(),
            to: dayAfter,
            maxPrice: '3000',
            available: true,
          })
        ).some((e) => e.id === publicId),
      ).toBe(false);
      const results = await catalog.listEvents({
        ...q,
        from: otherStart.toISOString(),
        maxPrice: '3000',
        available: true,
        sort: 'price_asc',
      });
      expect(results.find((e) => e.id === publicId)).toMatchObject({
        startsAt: otherStart.toISOString().replace('.000Z', 'Z'),
        startingPrice: '2000',
      });
      expect(
        (await catalog.listEvents({ ...q, to: start.toISOString() })).some(
          (e) => e.id === publicId,
        ),
      ).toBe(false);
      const heldSeats = (
        await pool.query<{ id: string }>(
          'SELECT id::text FROM session_seats WHERE session_id=$1 ORDER BY id',
          [otherSessionId],
        )
      ).rows.map((s) => s.id);
      await pool.query('UPDATE session_seats SET price_minor=9000 WHERE id=$1', [heldSeats[0]!]);
      const cheaperHold = await createHold(
        outsider,
        publicId,
        otherSessionId,
        heldSeats.slice(1),
        randomUUID(),
        randomUUID(),
        async () => {},
      );
      expect(
        (
          await catalog.listEvents({
            ...q,
            from: otherStart.toISOString(),
            maxPrice: '3000',
            available: true,
          })
        ).some((e) => e.id === publicId),
      ).toBe(false);
      expect(
        (
          await catalog.listEvents({
            ...q,
            from: otherStart.toISOString(),
            minPrice: '8000',
            available: true,
          })
        ).find((e) => e.id === publicId),
      ).toMatchObject({ startingPrice: '9000' });
      await releaseHold(outsider, cheaperHold.data.id, randomUUID(), randomUUID());
      await pool.query('UPDATE session_seats SET price_minor=2000 WHERE id=$1', [heldSeats[0]!]);
      const hold = await createHold(
        outsider,
        publicId,
        otherSessionId,
        heldSeats,
        randomUUID(),
        randomUUID(),
        async () => {},
      );
      expect(
        (
          await catalog.listEvents({
            ...q,
            from: otherStart.toISOString(),
            maxPrice: '3000',
            available: true,
          })
        ).some((e) => e.id === publicId),
      ).toBe(false);
      expect(
        (await catalog.listEvents({ ...q, from: otherStart.toISOString(), available: false })).some(
          (e) => e.id === publicId,
        ),
      ).toBe(true);
      await releaseHold(outsider, hold.data.id, randomUUID(), randomUUID());
    });
    it('hides only the Customer view and suggestions, preserves following and restores visibility on unblock', async () => {
      const app = createApp({ catalogRepository: catalog, checkDatabase }),
        bearer = await token(buyer);
      await pool.query(
        'INSERT INTO organization_follows(user_id,organization_id,notifications_enabled,notifications_enabled_at) VALUES($1,$2,true,now())',
        [buyer.id, organizationId],
      );
      await blocks.change(buyer, organizerPublicId, true);
      await blocks.change(buyer, organizerPublicId, true);
      await pool.query(
        "INSERT INTO notifications(recipient_user_id,type,event_id,payload_redacted) VALUES($1,'FOLLOWED_ORGANIZER_EVENT',$2,$3) ON CONFLICT DO NOTHING",
        [buyer.id, eventId, JSON.stringify({ eventId: publicId, title: 'Completion fixture' })],
      );
      expect(
        (await inbox(buyer, { page: 1, pageSize: 100 })).items.some(
          (row) => row.payload.eventId === publicId,
        ),
      ).toBe(false);
      expect((await blocks.list(buyer, 1, 20)).total).toBe(1);
      expect(await catalog.findEvent(publicId, buyer.id)).toBeNull();
      expect(await catalog.findEvent(publicId, outsider.id)).not.toBeNull();
      expect(await catalog.findEvent(publicId)).not.toBeNull();
      expect(
        (await new RecommendationService().list(buyer, 20)).items.some(
          (item) => item.event.id === publicId,
        ),
      ).toBe(false);
      const response = await request(app).get('/api/v1/catalog/home').set('Authorization', bearer);
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers.vary).toContain('Authorization');
      expect(JSON.stringify(response.body.data)).not.toContain(publicId);
      expect(
        (
          await request(app)
            .get('/api/v1/events/' + publicId)
            .set('Authorization', bearer)
        ).status,
      ).toBe(404);
      expect((await request(app).get('/api/v1/events/' + publicId)).status).toBe(200);
      expect(
        (
          await pool.query(
            'SELECT count(*)::int n FROM organization_follows WHERE user_id=$1 AND organization_id=$2',
            [buyer.id, organizationId],
          )
        ).rows[0].n,
      ).toBe(1);
      await expect(blocks.change(organizer, organizerPublicId, true)).rejects.toMatchObject({
        code: 'CUSTOMER_REQUIRED',
      });
      await blocks.change(buyer, organizerPublicId, false);
      expect(
        (await inbox(buyer, { page: 1, pageSize: 100 })).items.some(
          (row) => row.payload.eventId === publicId,
        ),
      ).toBe(true);
      expect(await catalog.findEvent(publicId, buyer.id)).not.toBeNull();
    });
    it('deletes only empty owned DRAFT and preserves dependencies, history and stale versions', async () => {
      const graph = await draft('Empty draft'),
        id = graph.event!.id;
      await expect(management.remove(outsider, id, 0, randomUUID())).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(management.remove(organizer, id, 1, randomUUID())).rejects.toMatchObject({
        code: 'EVENT_VERSION_CONFLICT',
      });
      await management.remove(organizer, id, 0, randomUUID());
      expect((await pool.query('SELECT id FROM events WHERE id=$1', [id])).rowCount).toBe(0);
      const dependent = await draft('Dependent draft');
      const layout = layoutInput.parse({
        version: 0,
        venueId: '904001',
        seats: [{ section: 'Main', row: 'A', number: '1', x: 3, y: 3, width: 1, height: 1 }],
      });
      const configured = await management.configure(
        organizer,
        dependent.event!.id,
        'layout',
        layout,
        0,
        randomUUID(),
        randomUUID(),
      );
      await expect(
        management.remove(organizer, dependent.event!.id, configured.event!.version, randomUUID()),
      ).rejects.toMatchObject({ code: 'EVENT_HAS_DEPENDENCIES' });
      expect(
        (await pool.query('SELECT id FROM seat_layouts WHERE event_id=$1', [dependent.event!.id]))
          .rowCount,
      ).toBe(1);
    });
    it('saves/version-checks reason drafts, previews text and never changes a sent notice', async () => {
      const fixture = await reviewFixture(true);
      const input = {
        version: 0,
        reasonCode: 'MISSING_INFORMATION',
        reason: 'Thông tin chưa đầy đủ',
        guidance: 'Bổ sung hồ sơ',
      };
      const saved = await management.saveReasonDraft(
        admin,
        fixture.reviewId,
        input,
        randomUUID(),
        randomUUID(),
      );
      expect(saved?.notice).toMatchObject({
        version: 1,
        status: 'DRAFT',
        reasonCode: 'MISSING_INFORMATION',
      });
      expect(
        (
          await pool.query(
            'SELECT resource_id::text FROM idempotency_records WHERE actor_scope=$1 AND operation=$2 ORDER BY id DESC LIMIT 1',
            [`user:${admin.id}`, 'event.review.reason_draft'],
          )
        ).rows[0].resource_id,
      ).toBe(saved!.notice!.id);
      expect((await management.reasonPreview(admin, fixture.reviewId)).preview).toContain(
        input.reason,
      );
      expect(
        (await management.reasonQueue(admin, 1, 100)).some(
          (row) => row.reviewId === fixture.reviewId,
        ),
      ).toBe(true);
      await expect(
        management.saveReasonDraft(admin, fixture.reviewId, input, randomUUID(), randomUUID()),
      ).rejects.toMatchObject({ code: 'NOTICE_VERSION_CONFLICT' });
      await management.sendReason(
        admin,
        fixture.reviewId,
        { ...input, version: 1 },
        randomUUID(),
        randomUUID(),
      );
      await expect(
        management.saveReasonDraft(
          admin,
          fixture.reviewId,
          { ...input, version: 2 },
          randomUUID(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'NOTICE_VERSION_CONFLICT' });
      const pending = await reviewFixture(false);
      await management.saveReasonDraft(admin, pending.reviewId, input, randomUUID(), randomUUID());
      await management.decide(
        admin,
        pending.reviewId,
        'REJECTED',
        {
          version: 0,
          reason: 'Cấu hình cần sửa',
          guidance: 'Sửa cấu hình',
          reasonCode: 'INVALID_CONFIGURATION',
        },
        randomUUID(),
        randomUUID(),
      );
      expect((await management.reasonPreview(admin, pending.reviewId)).notice).toMatchObject({
        status: 'SENT',
        reasonCode: 'INVALID_CONFIGURATION',
        reason: 'Cấu hình cần sửa',
      });
    });
    it('protects new HTTP endpoints and rejects unknown fields, stale claims and foreign origins', async () => {
      const app = createApp({ catalogRepository: catalog, checkDatabase }),
        ownerToken = await token(organizer),
        adminToken = await token(admin),
        buyerToken = await token(buyer);
      for (const path of [
        '/admin/audit-logs',
        '/admin/reports',
        '/admin/reason-notices',
        '/users/me/blocked-organizers',
        '/reports/' + eventId,
      ])
        expect((await request(app).get('/api/v1' + path)).status).toBe(401);
      expect(
        (
          await request(app)
            .get('/api/v1/events')
            .query({ from: '2026-10-15T00:00:00Z', to: '2026-10-14T00:00:00Z' })
        ).status,
      ).toBe(400);
      const blockedPath = '/api/v1/users/me/blocked-organizers/' + organizerPublicId;
      expect(
        (
          await request(app)
            .put(blockedPath)
            .set('Authorization', buyerToken)
            .set('Origin', env.PUBLIC_APP_URL!)
            .send({ userId: outsider.id })
        ).status,
      ).toBe(400);
      expect(
        (await request(app).put(blockedPath).set('Authorization', buyerToken).send({})).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .put(blockedPath)
            .set('Authorization', buyerToken)
            .set('Origin', env.PUBLIC_APP_URL!)
            .send({})
        ).status,
      ).toBe(200);
      expect(
        (
          await request(app)
            .delete(blockedPath)
            .set('Authorization', buyerToken)
            .set('Origin', env.PUBLIC_APP_URL!)
        ).status,
      ).toBe(204);
      const created = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', ownerToken)
        .set('Origin', env.PUBLIC_APP_URL!)
        .set('Idempotency-Key', randomUUID())
        .send({ eventId, reason: 'Organizer event report' });
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;
      expect(
        (
          await request(app)
            .get('/api/v1/reports/' + id)
            .set('Authorization', ownerToken)
        ).status,
      ).toBe(200);
      expect(
        (
          await request(app)
            .get('/api/v1/reports/' + id)
            .set('Authorization', buyerToken)
        ).status,
      ).toBe(404);
      const path = '/api/v1/admin/reports/' + id + '/claim';
      expect(
        (
          await request(app)
            .post(path)
            .set('Authorization', ownerToken)
            .set('Origin', env.PUBLIC_APP_URL!)
            .set('Idempotency-Key', randomUUID())
            .send({ version: 0 })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(path)
            .set('Authorization', adminToken)
            .set('Origin', 'https://foreign.invalid')
            .set('Idempotency-Key', randomUUID())
            .send({ version: 0 })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(path)
            .set('Authorization', adminToken)
            .set('Origin', env.PUBLIC_APP_URL!)
            .set('Idempotency-Key', randomUUID())
            .send({ version: 0, assignedAdminId: admin.id })
        ).status,
      ).toBe(400);
      expect(
        (
          await request(app)
            .post(path)
            .set('Authorization', adminToken)
            .set('Origin', env.PUBLIC_APP_URL!)
            .set('Idempotency-Key', randomUUID())
            .send({ version: 0 })
        ).status,
      ).toBe(200);
      expect(
        (
          await request(app)
            .post(path)
            .set('Authorization', adminToken)
            .set('Origin', env.PUBLIC_APP_URL!)
            .set('Idempotency-Key', randomUUID())
            .send({ version: 0 })
        ).status,
      ).toBe(409);
      expect(
        (await request(app).get('/api/v1/admin/audit-logs').set('Authorization', buyerToken))
          .status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .get('/api/v1/admin/event-reviews/' + id + '/reason')
            .set('Authorization', buyerToken)
        ).status,
      ).toBe(403);
      await reports.close(admin, id, 1, 'HTTP fixture resolved', randomUUID(), randomUUID());
    });
    it('scopes reports and audit, removes a published event without refunding or deleting paid history', async () => {
      const seats = (
        await pool.query<{ id: string }>(
          'SELECT id::text FROM session_seats WHERE session_id=$1 ORDER BY id',
          [sessionId],
        )
      ).rows.map((s) => s.id);
      const hold = await createHold(
        buyer,
        publicId,
        sessionId,
        [seats[0]!],
        randomUUID(),
        randomUUID(),
        async () => {},
      );
      const booking = await createBooking(
        buyer,
        {
          holdId: hold.data.id,
          attendees: [{ sessionSeatId: seats[0]!, attendeeName: 'Fixture attendee' }],
        },
        randomUUID(),
        randomUUID(),
      );
      const people = attendeesInput.parse({
        attendees: (booking.data.items as { id: string }[]).map((i) => ({
          bookingItemId: i.id,
          fullName: 'Fixture attendee',
          dateOfBirth: '1990-01-02',
          phone: '0901234567',
          cccd: '000000000001',
        })),
      }).attendees;
      await saveAttendees(buyer, booking.data.id, people, randomUUID());
      let link: PaymentLink;
      const gateway: PaymentGateway = {
        async create(data) {
          link = {
            orderCode: data.orderCode,
            amount: data.amount,
            id: randomUUID(),
            checkoutUrl: 'https://pay.payos.vn/web/fixture',
          };
          return link;
        },
        async find() {
          return link;
        },
        async status() {
          return { link, status: 'PENDING', receipts: [], amountPaid: 0 };
        },
        async verify() {
          throw new Error('No live provider');
        },
      };
      const port = new BookingPaymentAdapter(),
        payments = new PaymentService(
          gateway,
          port,
          new DatabaseTicketIssuer(),
          env.PUBLIC_APP_URL,
        ),
        tickets = new TicketService(port);
      await payments.start(buyer, booking.data.id, randomUUID(), randomUUID());
      await payments.accept({
        orderCode: String(link!.orderCode),
        amount: '9000',
        reference: randomUUID(),
        paymentLinkId: link!.id,
        currency: 'VND',
        code: '00',
      });
      const ticket = (await tickets.list(buyer, booking.data.id))[0]!;
      const report = await reports.create(
        buyer,
        { eventId, bookingId: booking.data.id, reason: 'Completion report' },
        randomUUID(),
        randomUUID(),
      );
      await expect(
        reports.create(
          outsider,
          { eventId, bookingId: booking.data.id, reason: ' чужой booking' },
          randomUUID(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(reports.detail(outsider, report.id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(reports.detail(organizer, report.id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(reports.list(organizer, reportQuery.parse({}), true)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await reports.claim(admin, report.id, 0, randomUUID(), randomUUID());
      const summary = await reports.booking(admin, booking.data.id, report.id, randomUUID());
      expect(summary).toMatchObject({
        id: booking.data.id,
        status: 'CONFIRMED',
        totalMinor: '9000',
      });
      expect(JSON.stringify(summary)).not.toMatch(/ticketCode|cccd|phone|checkoutUrl|attendee/);
      const row = (
        await pool.query<{ version: number }>('SELECT version FROM events WHERE id=$1', [eventId])
      ).rows[0]!;
      const input = { version: row.version, reportId: report.id, reason: 'Admin gỡ theo report' };
      const key = randomUUID();
      const oldAdmin = await account('ADMIN');
      await pool.query(
        "UPDATE auth_sessions SET authenticated_at=now()-interval '6 minutes' WHERE id=$1",
        [oldAdmin.actor.sessionId],
      );
      await expect(
        reports.unpublish(oldAdmin.actor, eventId, input, randomUUID(), randomUUID()),
      ).rejects.toMatchObject({ code: 'REAUTHENTICATION_REQUIRED' });
      const cachedSnapshot = await publicSeats(publicId, sessionId);
      await reports.unpublish(admin, eventId, input, key, randomUUID());
      await reports.unpublish(admin, eventId, input, key, randomUUID());
      expect(await catalog.findEvent(publicId)).toBeNull();
      const cachedRead = vi.fn(async () => JSON.stringify(cachedSnapshot));
      await expect(publicSeats(publicId, sessionId, cachedRead)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      expect(cachedRead).not.toHaveBeenCalled();
      await expect(
        createHold(
          outsider,
          publicId,
          sessionId,
          [seats[1]!],
          randomUUID(),
          randomUUID(),
          async () => {},
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        tickets.checkIn(
          organizer,
          sessionId,
          { ticketCode: ticket.ticketCode!, attendeeName: ticket.attendeeName },
          randomUUID(),
          randomUUID(),
          'COUNTER',
        ),
      ).rejects.toMatchObject({ code: 'TICKET_NOT_VALID' });
      await expect(
        tickets.admit(
          organizer,
          sessionId,
          {
            ticketCode: ticket.ticketCode!,
            fullName: 'Fixture attendee',
            dateOfBirth: '1990-01-02',
            cccd: '000000000001',
            physicalDocumentSeen: true,
          },
          randomUUID(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'TICKET_NOT_VALID' });
      expect(
        (await pool.query('SELECT status FROM bookings WHERE id=$1', [booking.data.id])).rows[0]
          .status,
      ).toBe('CONFIRMED');
      expect(
        (await pool.query('SELECT status FROM tickets WHERE id=$1', [ticket.id])).rows[0].status,
      ).toBe('VALID');
      expect(
        (
          await pool.query(
            'SELECT count(*)::int n FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.booking_id=$1',
            [booking.data.id],
          )
        ).rows[0].n,
      ).toBe(0);
      const audits = await new AuditService().list(
        admin,
        auditQuery.parse({ reportId: report.id }),
      );
      expect(audits.items.some((a) => a.action === 'event.unpublish')).toBe(true);
      expect(JSON.stringify(audits)).not.toMatch(
        /before_redacted|after_redacted|reason|cccd|cookie/,
      );
      await reports.close(admin, report.id, 1, 'Đã xử lý', randomUUID(), randomUUID());
      await expect(
        reports.booking(admin, booking.data.id, report.id, randomUUID()),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        reports.unpublish(admin, eventId, input, key, randomUUID()),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  },
);
