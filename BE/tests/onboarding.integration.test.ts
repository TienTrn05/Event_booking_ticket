import { QuestionnaireService } from '../src/modules/users/onboarding/questions/questionnaire.service.js';
import { questionsSchema } from '../src/modules/users/onboarding/questions/questionnaire.schema.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/shared/database/pool.js';
import { withTransaction } from '../src/shared/database/transaction.js';
import { identityRepository } from '../src/modules/auth/account/identity.repository.js';
import { OnboardingService } from '../src/modules/users/onboarding/onboarding.service.js';
import { onboardingInput } from '../src/modules/users/onboarding/onboarding.schema.js';
import { OrganizationService } from '../src/modules/organizations/application/organization.service.js';
import { ManagementAccessRepository } from '../src/shared/auth/management-access.repository.js';
import { RecommendationService } from '../src/modules/catalog/recommendations/recommendation.service.js';
import { updateProfile } from '../src/modules/users/services/users.service.js';
import { createApp } from '../src/app.js';
import { accessToken } from '../src/modules/auth/session/session.service.js';
import { env } from '../src/config/env.js';
import type { RequestActor } from '../src/shared/auth/request-actor.js';
import { EventManagementService } from '../src/modules/events/management/event-management.service.js';
import {
  draftInput,
  layoutInput,
  sessionInput,
  pricingInput,
} from '../src/modules/events/management/event-management.schema.js';
import { mediaRepository } from '../src/modules/media/repositories/media.repository.js';
import { createHold } from '../src/modules/bookings/holds/hold.service.js';
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

const onboarding = new OnboardingService(),
  organizations = new OrganizationService();
async function newUser(): Promise<RequestActor> {
  return withTransaction(async (db) => {
    const { userId } = await identityRepository.createEmailUser(db);
    const identityId = await identityRepository.addEmailIdentity(
      db,
      userId,
      randomUUID() + '@fixture.invalid',
    );
    const session = (
      await db.query<{ id: string }>(
        `INSERT INTO auth_sessions(user_id,identity_id,authenticated_at,family_id,expires_at) VALUES($1,$2,now(),$3,now()+interval '7 days') RETURNING id::text`,
        [userId, identityId, randomBytes(32)],
      )
    ).rows[0]!;
    return { id: userId, sessionId: session.id, authVersion: 0 };
  });
}
const input = (role: 'CUSTOMER' | 'ORGANIZER') =>
  onboardingInput.parse({
    role,
    displayName: 'Onboarding fixture',
    gender: 'UNDISCLOSED',
    dateOfBirth: '1990-01-02',
  });
describe.skipIf(!process.env.COMMERCE_TEST_DB_PORT)('onboarding on isolated PostgreSQL', () => {
  afterAll(async () => pool.end());
  it('cannot approve a revoked applicant identity but can reject its application for resubmission', async () => {
    const organizer = await newUser(),
      admin = await newUser();
    await onboarding.complete(organizer, input('ORGANIZER'), randomUUID(), randomUUID());
    await pool.query(
      `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'`,
      [admin.id],
    );
    const organization = (await organizations.apply(
      organizer,
      { name: 'Revoked proof fixture' },
      randomUUID(),
      randomUUID(),
    ))!;
    await pool.query('UPDATE external_identities SET revoked_at=clock_timestamp() WHERE id=$1', [
      organization.applicant_identity_id,
    ]);
    await expect(
      organizations.decide(
        admin,
        organization.id,
        true,
        { version: organization.version, reason: 'Fixture' },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'IDENTITY_INVALID' });
    expect(
      (await organizations.decide(
        admin,
        organization.id,
        false,
        { version: organization.version, reason: 'Cần xác minh lại danh tính' },
        randomUUID(),
        randomUUID(),
      ))!.status,
    ).toBe('REJECTED');
  });
  it('commits review expiry before returning conflict and sends its reason once', async () => {
    const organizer = await newUser(),
      admin = await newUser();
    await onboarding.complete(organizer, input('ORGANIZER'), randomUUID(), randomUUID());
    await pool.query(
      `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'`,
      [admin.id],
    );
    const organization = (await organizations.apply(
      organizer,
      { name: 'Expiry fixture' },
      randomUUID(),
      randomUUID(),
    ))!;
    const service = new EventManagementService();
    const graph = await service.create(
      organizer,
      draftInput.parse({
        organizationId: organization.id,
        title: 'Expiry event',
        categoryId: '1',
        description: 'Fixture',
      }),
      randomUUID(),
      randomUUID(),
    );
    const eventId = graph.event!.id;
    const review = (
      await pool.query<{ id: string }>(
        `INSERT INTO event_reviews(event_id,event_version,submitted_by,submitted_at,expires_at,earliest_session_starts_at,submission_cutoff_at,calendar_timezone,snapshot_json) VALUES($1,0,$2,now()-interval '16 days',now()-interval '1 day',now()+interval '60 days',now()+interval '1 day','Asia/Ho_Chi_Minh','{}') RETURNING id::text`,
        [eventId, organizer.id],
      )
    ).rows[0]!;
    await pool.query(`UPDATE events SET status='PENDING_REVIEW' WHERE id=$1`, [eventId]);
    await expect(
      service.decide(
        admin,
        review.id,
        'APPROVED',
        { version: 0, reason: 'Fixture' },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'REVIEW_EXPIRED' });
    expect((await service.get(organizer, eventId)).event!.status).toBe('REJECTED');
    expect(
      (await pool.query('SELECT status FROM event_reviews WHERE id=$1', [review.id])).rows[0]
        .status,
    ).toBe('EXPIRED');
    const key = randomUUID(),
      reason = { version: 0, reason: 'Chưa đủ thông tin duyệt', guidance: 'Bổ sung và gửi lại' };
    const notice = await service.sendReason(admin, review.id, reason, key, randomUUID());
    expect(await service.sendReason(admin, review.id, reason, key, randomUUID())).toEqual(notice);
    await expect(
      service.sendReason(admin, review.id, reason, randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ code: 'NOTICE_VERSION_CONFLICT' });
    const reopened = await service.configure(
      organizer,
      eventId,
      'reopen',
      { version: 0 },
      0,
      randomUUID(),
      randomUUID(),
    );
    expect(reopened.event!.status).toBe('DRAFT');
    expect(reopened.event!.version).toBe(1);
  });
  it('creates a draft before organization approval, freezes review, publishes inventory then pays and admits', async () => {
    const organizer = await newUser(),
      buyer = await newUser(),
      admin = await newUser();
    await onboarding.complete(organizer, input('ORGANIZER'), randomUUID(), randomUUID());
    await onboarding.complete(buyer, input('CUSTOMER'), randomUUID(), randomUUID());
    await pool.query(
      `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'`,
      [admin.id],
    );
    const organization = (await organizations.apply(
      organizer,
      { name: 'End-to-end fixture' },
      randomUUID(),
      randomUUID(),
    ))!;
    const service = new EventManagementService();
    let graph = await service.create(
      organizer,
      draftInput.parse({
        organizationId: organization.id,
        title: 'End-to-end event',
        categoryId: '1',
        description: 'Fixture event',
        minimumAge: 18,
      }),
      randomUUID(),
      randomUUID(),
    );
    const eventId = graph.event!.id;
    await expect(service.get(buyer, eventId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const layout = layoutInput.parse({
      version: graph.event!.version,
      venueId: '904001',
      stage: { x: 0, y: 0, width: 5, height: 2 },
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
    graph = await service.configure(
      organizer,
      eventId,
      'layout',
      layout,
      layout.version,
      randomUUID(),
      randomUUID(),
    );
    const now = Date.now(),
      iso = (offset: number) => new Date(now + offset).toISOString();
    const sessionData = sessionInput.parse({
      version: graph.event!.version,
      layoutId: graph.layouts[0]!.id,
      startsAt: iso(60 * 86400000),
      endsAt: iso(61 * 86400000),
      saleOpensAt: iso(-60000),
      saleClosesAt: iso(59 * 86400000),
      counterOpensAt: iso(-60000),
      counterClosesAt: iso(60 * 86400000),
      admissionOpensAt: iso(-60000),
      admissionClosesAt: iso(61 * 86400000),
    });
    graph = await service.configure(
      organizer,
      eventId,
      'session',
      sessionData,
      sessionData.version,
      randomUUID(),
      randomUUID(),
    );
    const sessionId = graph.sessions[0]!.id;
    graph = await service.configure(
      organizer,
      eventId,
      'type',
      { version: graph.event!.version, code: 'STANDARD', name: 'Standard' },
      graph.event!.version,
      randomUUID(),
      randomUUID(),
      sessionId,
    );
    const prices = pricingInput.parse({
      version: graph.event!.version,
      prices: graph.seats.map((s) => ({
        seatId: s.id,
        ticketTypeId: graph.ticketTypes[0]!.id,
        priceMinor: '2000',
        currency: 'VND',
      })),
    });
    graph = await service.configure(
      organizer,
      eventId,
      'prices',
      prices,
      prices.version,
      randomUUID(),
      randomUUID(),
      sessionId,
    );
    await expect(
      service.submit(organizer, eventId, graph.event!.version, randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ code: 'EVENT_IMAGE_REQUIRED' });
    // R2 signature/HEAD have separate upload verification. Use only an owned fixture URL here.
    await withTransaction((db) =>
      mediaRepository.save(
        db,
        organizer,
        {
          purpose: 'event',
          targetId: eventId,
          version: graph.event!.version,
          contentType: 'image/png',
          size: 1,
        },
        'https://images.fixture.invalid/event.png',
        randomUUID(),
      ),
    );
    graph = await service.get(organizer, eventId);
    graph = await service.submit(
      organizer,
      eventId,
      graph.event!.version,
      randomUUID(),
      randomUUID(),
    );
    expect(graph.event!.status).toBe('PENDING_REVIEW');
    expect(
      (
        await pool.query('SELECT count(*)::int n FROM session_seats WHERE session_id=$1', [
          sessionId,
        ])
      ).rows[0].n,
    ).toBe(0);
    const reviewId = graph.reviews[0]!.id,
      version = graph.event!.version;
    await expect(
      service.configure(
        organizer,
        eventId,
        'edit',
        { title: 'Tamper' },
        version,
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'EVENT_VERSION_CONFLICT' });
    await expect(
      service.decide(
        admin,
        reviewId,
        'APPROVED',
        { version, reason: 'Fixture' },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'ORGANIZATION_NOT_APPROVED' });
    await organizations.decide(
      admin,
      organization.id,
      true,
      { version: organization.version, reason: 'Fixture' },
      randomUUID(),
      randomUUID(),
    );
    const decisionKey = randomUUID();
    await service.decide(
      admin,
      reviewId,
      'APPROVED',
      { version, reason: 'Fixture' },
      decisionKey,
      randomUUID(),
    );
    await service.decide(
      admin,
      reviewId,
      'APPROVED',
      { version, reason: 'Fixture' },
      decisionKey,
      randomUUID(),
    );
    const publicId = (await pool.query('SELECT public_id FROM events WHERE id=$1', [eventId]))
      .rows[0].public_id as string;
    const seats = (
      await pool.query<{ id: string }>(
        'SELECT id::text FROM session_seats WHERE session_id=$1 ORDER BY id',
        [sessionId],
      )
    ).rows.map((s) => s.id);
    expect(seats).toHaveLength(3);
    const hold = await createHold(
      buyer,
      publicId,
      sessionId,
      seats,
      randomUUID(),
      randomUUID(),
      async () => {},
    );
    const booking = await createBooking(
      buyer,
      {
        holdId: hold.data.id,
        attendees: seats.map((id, i) => ({ sessionSeatId: id, attendeeName: 'Fixture ' + i })),
      },
      randomUUID(),
      randomUUID(),
    );
    const people = attendeesInput.parse({
      attendees: (booking.data.items as { id: string }[]).map((item, i) => ({
        bookingItemId: item.id,
        fullName: 'Fixture ' + i,
        dateOfBirth: '1990-01-02',
        phone: '0901234567',
        cccd: '00000000000' + i,
      })),
    }).attendees;
    await saveAttendees(buyer, booking.data.id, people, randomUUID());
    let link: PaymentLink | undefined;
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
        return link!;
      },
      async status() {
        return { link: link!, status: 'PENDING', receipts: [], amountPaid: 0 };
      },
      async verify() {
        throw new Error('No live payment');
      },
    };
    const port = new BookingPaymentAdapter(),
      payments = new PaymentService(gateway, port, new DatabaseTicketIssuer(), env.PUBLIC_APP_URL),
      tickets = new TicketService(port);
    const payment = await payments.start(buyer, booking.data.id, randomUUID(), randomUUID());
    const receipt = {
      orderCode: String(link!.orderCode),
      amount: '6000',
      reference: randomUUID(),
      paymentLinkId: link!.id,
      currency: 'VND',
      code: '00',
    };
    await payments.accept(receipt);
    await payments.accept(receipt);
    expect((await payments.get(buyer, payment.id)).status).toBe('SUCCESS');
    const issued = await tickets.list(buyer, booking.data.id);
    expect(issued).toHaveLength(3);
    const ticket = issued[0]!,
      person = people[0]!;
    await tickets.checkIn(
      organizer,
      sessionId,
      { ticketCode: ticket.ticketCode!, attendeeName: ticket.attendeeName },
      randomUUID(),
      randomUUID(),
      'COUNTER',
    );
    const proof = {
      ticketCode: ticket.ticketCode!,
      cccd: person.cccd,
      fullName: person.fullName,
      dateOfBirth: person.dateOfBirth,
      physicalDocumentSeen: true as const,
    };
    const entryKey = randomUUID();
    await tickets.admit(organizer, sessionId, proof, entryKey, randomUUID());
    expect((await tickets.admit(organizer, sessionId, proof, entryKey, randomUUID())).status).toBe(
      'USED',
    );
  });
  it('creates an unprivileged verified user and assigns exactly the selected role once', async () => {
    const actor = await newUser();
    expect((await onboarding.state(actor)).roles).toEqual([]);
    const key = randomUUID();
    const result = await onboarding.complete(actor, input('ORGANIZER'), key, randomUUID());
    expect(result.completed).toBe(true);
    expect(result.roles).toEqual(['ORGANIZER']);
    expect(result.favoriteCategories).toEqual([]);
    expect((await onboarding.complete(actor, input('ORGANIZER'), key, randomUUID())).roles).toEqual(
      ['ORGANIZER'],
    );
    await expect(
      onboarding.complete(actor, input('CUSTOMER'), key, randomUUID()),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      onboarding.complete(actor, input('CUSTOMER'), randomUUID(), randomUUID()),
    ).rejects.toMatchObject({ code: 'ONBOARDING_COMPLETE' });
    expect((await onboarding.customer(actor, randomUUID(), randomUUID())).roles).toEqual([
      'CUSTOMER',
      'ORGANIZER',
    ]);
  });
  it('rejects invalid preferences and future DOB without granting a role', async () => {
    const actor = await newUser();
    await expect(
      onboarding.complete(
        actor,
        { ...input('CUSTOMER'), dateOfBirth: '2999-01-01' },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_DATE_OF_BIRTH' });
    await expect(
      onboarding.complete(
        actor,
        { ...input('CUSTOMER'), favoriteCategories: ['nonexistent-fixture'] },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'UNKNOWN_CATEGORY' });
    expect((await onboarding.state(actor)).roles).toEqual([]);
    await onboarding.complete(actor, input('CUSTOMER'), randomUUID(), randomUUID());
    await expect(onboarding.customer(actor, randomUUID(), randomUUID())).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(updateProfile(actor, { gender: null }, randomUUID())).rejects.toMatchObject({
      code: 'PROFILE_FIELDS_REQUIRED',
    });
    expect((await onboarding.state(actor)).profile.gender).toBe('UNDISCLOSED');
  });
  it('allows personal email Organizer draft scope but reserves organization approval for Admin', async () => {
    const actor = await newUser(),
      other = await newUser(),
      admin = await newUser();
    await onboarding.complete(actor, input('ORGANIZER'), randomUUID(), randomUUID());
    await onboarding.complete(other, input('CUSTOMER'), randomUUID(), randomUUID());
    const row = (await organizations.apply(
      actor,
      { name: 'Personal-email fixture' },
      randomUUID(),
      randomUUID(),
    ))!;
    expect(row.status).toBe('PENDING_REVIEW');
    const access = new ManagementAccessRepository();
    await withTransaction((db) => access.organizer(db, actor, row.id, 'event.update_own', true));
    await expect(
      withTransaction((db) => access.organizer(db, actor, row.id, 'event.update_own')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(organizations.get(other, row.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      organizations.decide(
        actor,
        row.id,
        true,
        { version: row.version, reason: 'fixture' },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // Fixture only: no production account or public registration endpoint grants Admin.
    await pool.query(
      `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'`,
      [admin.id],
    );
    const approved = (await organizations.decide(
      admin,
      row.id,
      true,
      { version: row.version, reason: 'Fixture review' },
      randomUUID(),
      randomUUID(),
    ))!;
    expect(approved.status).toBe('APPROVED');
    await withTransaction((db) => access.organizer(db, actor, row.id, 'event.update_own'));
    expect((await onboarding.state(actor)).roles).toEqual(['ORGANIZER']);
  });
  it('serves onboarding without caching, rejects Admin and enforces Origin on mutations', async () => {
    const actor = await newUser();
    const token = await accessToken({
      userId: actor.id,
      sessionId: actor.sessionId,
      authVersion: actor.authVersion,
      identityId: '0',
      displayName: 'Fixture',
      refreshToken: '',
      expiresAt: new Date(Date.now() + 60000),
    });
    const app = createApp({ checkDatabase: async () => {} });
    const state = await request(app)
      .get('/api/v1/users/me/onboarding')
      .set('Authorization', `Bearer ${token}`);
    expect(state.status).toBe(200);
    expect(state.headers['cache-control']).toContain('no-store');
    const invalid = await request(app)
      .put('/api/v1/users/me/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', new URL(env.PUBLIC_APP_URL!).origin)
      .set('Idempotency-Key', randomUUID())
      .send({ ...input('CUSTOMER'), role: 'ADMIN' });
    expect(invalid.status).toBe(400);
    const wrongOrigin = await request(app)
      .put('/api/v1/users/me/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'https://other.fixture.invalid')
      .set('Idempotency-Key', randomUUID())
      .send(input('CUSTOMER'));
    expect(wrongOrigin.status).toBe(403);
    expect((await onboarding.state(actor)).roles).toEqual([]);
  });
  it('returns unique public future recommendations without exposing sales counts or DOB', async () => {
    const actor = await newUser();
    await onboarding.complete(actor, input('CUSTOMER'), randomUUID(), randomUUID());
    const result = await new RecommendationService().list(actor, 12);
    expect(result.algorithm).toBe('RULES_V1');
    expect(new Set(result.items.map((i) => i.event.id)).size).toBe(result.items.length);
    expect(JSON.stringify(result)).not.toContain('popularity');
    expect(JSON.stringify(result)).not.toContain('dateOfBirth');
    for (const item of result.items)
      expect(new Date(item.event.startsAt).getTime()).toBeGreaterThan(Date.now() - 1000);
  });
  it('restricts publishing to Admin, versions required questions and preserves completed answers', async () => {
    const admin = await newUser(),
      customer = await newUser(),
      pending = await newUser();
    await pool.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
      [admin.id],
    );
    await onboarding.complete(customer, input('CUSTOMER'), randomUUID(), randomUUID());
    const service = new QuestionnaireService(),
      original = await service.get(admin);
    expect(
      (
        await service.publish(
          admin,
          { questionnaireId: original.id, questions: original.questions },
          randomUUID(),
          randomUUID(),
        )
      ).id,
    ).toBe(original.id);
    const token = await accessToken({
      userId: admin.id,
      sessionId: admin.sessionId,
      authVersion: 0,
      identityId: '0',
      displayName: 'Fixture',
      refreshToken: '',
      expiresAt: new Date(Date.now() + 60000),
    });
    const app = createApp({ checkDatabase: async () => {} });
    await request(app)
      .get('/api/v1/admin/onboarding/questions')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    const core = await request(app)
      .put('/api/v1/admin/onboarding/questions')
      .set('Authorization', 'Bearer ' + token)
      .set('Origin', env.PUBLIC_APP_URL!)
      .set('Idempotency-Key', randomUUID())
      .send({
        questionnaireId: original.id,
        questions: [{ key: 'role', kind: 'TEXT', label: 'Role', required: false }],
      });
    expect(core.status).toBe(400);
    await expect(
      service.publish(
        customer,
        { questionnaireId: original.id, questions: [] },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    try {
      const questions = questionsSchema.parse([
        { key: 'preferredCity', kind: 'CITY', label: 'Bạn ở đâu?', required: true },
        { key: 'custom_goal', kind: 'TEXT', label: 'Mục tiêu tham dự?', required: true },
      ]);
      const key = randomUUID(),
        form = await service.publish(
          admin,
          { questionnaireId: original.id, questions },
          key,
          randomUUID(),
        );
      expect(
        (
          await service.publish(
            admin,
            { questionnaireId: original.id, questions },
            key,
            randomUUID(),
          )
        ).id,
      ).toBe(form.id);
      await expect(
        service.publish(
          admin,
          { questionnaireId: original.id, questions: [] },
          randomUUID(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'ONBOARDING_QUESTIONNAIRE_CHANGED' });
      await expect(
        onboarding.complete(
          pending,
          { ...input('ORGANIZER'), questionnaireId: form.id },
          randomUUID(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'ONBOARDING_ANSWER_REQUIRED' });
      expect((await onboarding.state(pending)).roles).toEqual([]);
      const completionKey = randomUUID(),
        payload = {
          ...input('ORGANIZER'),
          questionnaireId: form.id,
          preferredCity: 'Ha Noi',
          answers: { custom_goal: 'Học tổ chức sự kiện' },
        };
      const completed = await onboarding.complete(pending, payload, completionKey, randomUUID());
      expect(completed.questionnaire!.id).toBe(form.id);
      expect(completed.answers).toEqual(payload.answers);
      const empty = await service.publish(
        admin,
        { questionnaireId: form.id, questions: [] },
        randomUUID(),
        randomUUID(),
      );
      expect((await onboarding.state(pending)).questionnaire!.questions).toHaveLength(2);
      expect((await onboarding.state(pending)).completed).toBe(true);
      expect(
        (await onboarding.complete(pending, payload, completionKey, randomUUID())).questionnaire!
          .id,
      ).toBe(form.id);
      expect(
        (await onboarding.answers(pending, { custom_goal: 'Giao lưu' }, randomUUID())).answers
          .custom_goal,
      ).toBe('Giao lưu');
      const fresh = await newUser();
      await expect(
        onboarding.complete(
          fresh,
          { ...input('CUSTOMER'), questionnaireId: form.id },
          randomUUID(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'ONBOARDING_QUESTIONNAIRE_CHANGED' });
      expect((await onboarding.state(fresh)).roles).toEqual([]);
      expect(
        (
          await onboarding.complete(
            fresh,
            { ...input('CUSTOMER'), questionnaireId: empty.id },
            randomUUID(),
            randomUUID(),
          )
        ).roles,
      ).toEqual(['CUSTOMER']);
    } finally {
      // Only isolated fixture DB: restore baseline for independent commerce/browser tests.
      await pool.query(
        "UPDATE onboarding_questionnaires SET status='ARCHIVED' WHERE status='ACTIVE'",
      );
      await pool.query("UPDATE onboarding_questionnaires SET status='ACTIVE' WHERE id=$1", [
        original.id,
      ]);
    }
  });
});
