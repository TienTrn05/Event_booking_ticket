import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type * as AuthService from '../src/modules/auth/auth.service.js';
import * as bookings from '../src/modules/bookings/booking.service.js';
import { waitingRoom } from '../src/modules/bookings/waiting-room/waiting-room.service.js';
import type { CatalogRepository } from '../src/modules/catalog/catalog.repository.js';
import * as ages from '../src/modules/events/age/age.service.js';
import * as media from '../src/modules/media/services/media.service.js';
import * as notifications from '../src/modules/notifications/services/notifications.service.js';
import * as attendees from '../src/modules/tickets/attendees/attendee.service.js';
import * as users from '../src/modules/users/services/users.service.js';

vi.mock('../src/modules/auth/auth.service.js', async (original) => ({
  ...(await original<typeof AuthService>()),
  authenticatedUser: vi.fn(async () => ({
    id: '1',
    sessionId: '2',
    authVersion: 0,
    displayName: 'Fixture',
  })),
  recordGoogleFailure: vi.fn(async () => {}),
}));
vi.mock('../src/modules/bookings/booking.service.js', () => ({
  createHold: vi.fn(),
  releaseHold: vi.fn(),
  getHold: vi.fn(),
  createBooking: vi.fn(),
  cancelBooking: vi.fn(),
  getBooking: vi.fn(),
  listBookings: vi.fn(),
}));
vi.mock('../src/modules/users/services/users.service.js', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock('../src/modules/notifications/services/notifications.service.js', () => ({
  followAction: vi.fn(),
  listFollowing: vi.fn(),
  inbox: vi.fn(),
  readNotification: vi.fn(),
}));
vi.mock('../src/modules/events/age/age.service.js', () => ({
  updateAgeRestriction: vi.fn(),
  ageEligibility: vi.fn(),
}));
vi.mock('../src/modules/tickets/attendees/attendee.service.js', () => ({
  getAttendees: vi.fn(),
  saveAttendees: vi.fn(),
  verifyAttendee: vi.fn(),
}));
vi.mock('../src/modules/media/services/media.service.js', () => ({
  createImageUpload: vi.fn(),
  completeImageUpload: vi.fn(),
  getAvatar: vi.fn(),
}));
vi.mock('../src/modules/bookings/waiting-room/waiting-room.service.js', () => ({
  waitingRoom: vi.fn(),
  returnAdmission: vi.fn(),
}));

const origin = 'http://127.0.0.1:5173';
function app() {
  const repository: CatalogRepository = {
    listCategories: vi.fn(async () => []),
    listEvents: vi.fn(async () => []),
    findEvent: vi.fn(async () => null),
    listOrganizers: vi.fn(async () => []),
    findOrganizer: vi.fn(async () => null),
    listMerchandise: vi.fn(async () => []),
    findMerchandise: vi.fn(async () => null),
    listArticles: vi.fn(async () => []),
    findArticle: vi.fn(async () => null),
    listChangeRequests: vi.fn(async () => []),
    listLocations: vi.fn(async () => []),
    listVenues: vi.fn(async () => []),
    findVenue: vi.fn(async () => null),
  };
  return {
    api: createApp({ checkDatabase: async () => {}, catalogRepository: repository }),
    repository,
  };
}

beforeEach(() => vi.clearAllMocks());
describe('HTTP validation and routing after separation', () => {
  it.each([
    '/api/v1/venues/abc',
    '/api/v1/venues/0',
    '/api/v1/venues/9223372036854775808',
    '/api/v1/organizers?featured=yes',
    '/api/v1/organizers?featured=true&featured=false',
    '/api/v1/events?page=100001',
    '/api/v1/events?page[]=1',
    '/api/v1/events?pageSize=101',
  ])('returns 400 before querying catalog: %s', async (url) => {
    const { api, repository } = app();
    const response = await request(api).get(url).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID' })]),
    );
    expect(repository.findVenue).not.toHaveBeenCalled();
    expect(repository.listOrganizers).not.toHaveBeenCalled();
    expect(repository.listEvents).not.toHaveBeenCalled();
  });
  it('preserves catalog defaults and false filters', async () => {
    const { api, repository } = app();
    await request(api).get('/api/v1/events').expect(200);
    expect(repository.listEvents).toHaveBeenCalledWith({ page: 1, pageSize: 24 });
    await request(api).get('/api/v1/organizers?featured=false').expect(200);
    expect(repository.listOrganizers).toHaveBeenCalledWith(false);
  });
  it('rejects profile mass assignment before mutation', async () => {
    const response = await request(app().api)
      .patch('/api/v1/users/me')
      .set('Origin', origin)
      .send({ displayName: 'An', role: 'ADMIN' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(users.updateProfile).not.toHaveBeenCalled();
  });
  it('keeps profile actor, normalization, request ID and no-store', async () => {
    vi.mocked(users.updateProfile).mockResolvedValue({
      id: '1',
      displayName: 'Nguyễn An',
      avatarUrl: null,
      gender: null,
      dateOfBirth: null,
    });
    const response = await request(app().api)
      .patch('/api/v1/users/me')
      .set('Origin', origin)
      .send({ displayName: '  Nguyễn An  ' })
      .expect(200);
    expect(users.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', sessionId: '2', authVersion: 0 }),
      { displayName: 'Nguyễn An' },
      expect.any(String),
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data.displayName).toBe('Nguyễn An');
  });
  it('retains origin checks before mutation', async () => {
    await request(app().api)
      .patch('/api/v1/users/me')
      .set('Origin', 'https://invalid.example')
      .send({ displayName: 'An' })
      .expect(403);
    expect(users.updateProfile).not.toHaveBeenCalled();
  });
  it('rejects malformed notification IDs and repeated pagination', async () => {
    await request(app().api)
      .post('/api/v1/notifications/abc/read')
      .set('Origin', origin)
      .expect(400);
    await request(app().api).get('/api/v1/notifications?page=1&page=2').expect(400);
    expect(notifications.readNotification).not.toHaveBeenCalled();
    expect(notifications.inbox).not.toHaveBeenCalled();
  });
  it('rejects duplicate hold seats and missing idempotency keys', async () => {
    await request(app().api)
      .post('/api/v1/events/fe1/sessions/1/seats/hold')
      .set('Origin', origin)
      .set('Idempotency-Key', 'fixture-key')
      .send({ seatIds: ['1', '1'] })
      .expect(400);
    await request(app().api)
      .post('/api/v1/events/fe1/sessions/1/seats/hold')
      .set('Origin', origin)
      .send({ seatIds: ['1'] })
      .expect(400);
    expect(bookings.createHold).not.toHaveBeenCalled();
  });
  it.each([[], { capacity: 500 }, 'configuration'])(
    'rejects waiting-room client configuration %j',
    async (body) => {
      await request(app().api)
        .post('/api/v1/events/fe1/sessions/1/waiting-room')
        .set('Origin', origin)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(body))
        .expect(400);
      expect(waitingRoom).not.toHaveBeenCalled();
    },
  );
  it('retains waiting-room action and retry response', async () => {
    vi.mocked(waitingRoom).mockResolvedValue({
      status: 'QUEUED',
      position: 1,
      admissionExpiresAt: null,
      waiting: 1,
      active: 0,
      serverTime: new Date(),
      pollAfterSeconds: 3,
    });
    const response = await request(app().api)
      .post('/api/v1/events/fe1/sessions/1/waiting-room')
      .set('Origin', origin)
      .send({})
      .expect(200);
    expect(waitingRoom).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }),
      'fe1',
      '1',
      'join',
    );
    expect(response.headers['retry-after']).toBe('3');
  });
  it('rejects invalid event versions and dates before age services', async () => {
    await request(app().api)
      .patch('/api/v1/events/1/age-restriction')
      .set('Origin', origin)
      .send({ minimumAge: 18, version: 2147483648 })
      .expect(400);
    await request(app().api)
      .post('/api/v1/events/fe1/sessions/1/age-eligibility')
      .set('Origin', origin)
      .send({ dateOfBirth: '2025-02-29' })
      .expect(400);
    expect(ages.updateAgeRestriction).not.toHaveBeenCalled();
    expect(ages.ageEligibility).not.toHaveBeenCalled();
  });
  it('rejects duplicate attendees and false document proof', async () => {
    const attendee = {
      bookingItemId: '1',
      fullName: 'An',
      dateOfBirth: '2000-01-01',
      phone: '0901234567',
      cccd: '123456789012',
    };
    await request(app().api)
      .put('/api/v1/bookings/1/attendees')
      .set('Origin', origin)
      .send({ attendees: [attendee, attendee] })
      .expect(400);
    await request(app().api)
      .post('/api/v1/tickets/1/attendee-verification')
      .set('Origin', origin)
      .send({
        fullName: 'An',
        dateOfBirth: '2000-01-01',
        cccd: '123456789012',
        physicalDocumentSeen: false,
      })
      .expect(400);
    expect(attendees.saveAttendees).not.toHaveBeenCalled();
    expect(attendees.verifyAttendee).not.toHaveBeenCalled();
  });
  it('rejects upload mass assignment and invalid completion tokens', async () => {
    await request(app().api)
      .post('/api/v1/media/uploads')
      .set('Origin', origin)
      .send({ purpose: 'avatar', contentType: 'image/png', size: 12, userId: '999' })
      .expect(400);
    await request(app().api)
      .post('/api/v1/media/uploads/complete')
      .set('Origin', origin)
      .send({ uploadToken: '', key: 'client-selected' })
      .expect(400);
    expect(media.createImageUpload).not.toHaveBeenCalled();
    expect(media.completeImageUpload).not.toHaveBeenCalled();
  });
  it('keeps auth config/CSRF and rejects unknown Google fields', async () => {
    const { api } = app();
    await request(api).get('/api/v1/auth/config').expect(200);
    const csrf = await request(api).get('/api/v1/auth/csrf').expect(200);
    const cookies: unknown = csrf.headers['set-cookie'];
    if (!Array.isArray(cookies) || typeof cookies[0] !== 'string')
      throw new Error('Missing CSRF cookie');
    const cookie = cookies[0].split(';')[0];
    if (!cookie) throw new Error('Empty CSRF cookie');
    expect(csrf.headers['cache-control']).toBe('no-store');
    await request(api)
      .post('/api/v1/auth/google/start')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf.body.data.csrfToken)
      .send({ role: 'ADMIN' })
      .expect(400);
    await request(api).post('/api/v1/auth/refresh').set('Origin', origin).expect(403);
  });
  it('returns JSON parsing errors through the existing envelope', async () => {
    const response = await request(app().api)
      .patch('/api/v1/users/me')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });
  it('rejects unsupported bodies instead of silently treating them as empty', async () => {
    const response = await request(app().api)
      .post('/api/v1/events/fe1/sessions/1/waiting-room')
      .set('Origin', origin)
      .send('capacity=100')
      .expect(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(waitingRoom).not.toHaveBeenCalled();
  });
});
