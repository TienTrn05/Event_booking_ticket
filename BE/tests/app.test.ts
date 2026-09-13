import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
describe('HTTP scaffold security', () => {
  it('liveness does not require a database', async () => {
    const response = await request(
      createApp({
        checkDatabase: async () => {
          throw new Error('not called');
        },
      }),
    ).get('/api/v1/health/live');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-request-id']).toBe(response.body.meta.requestId);
  });
  it('does not expose database errors or credentials', async () => {
    const response = await request(
      createApp({
        checkDatabase: async () => {
          throw new Error('sensitive-fixture-password SQL SELECT');
        },
      }),
    ).get('/api/v1/health/ready');
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(response.text).not.toContain('sensitive-fixture-password');
    expect(response.text).not.toContain('SELECT');
  });
  it('returns the error envelope for invalid JSON', async () => {
    const response = await request(createApp({ checkDatabase: async () => {} }))
      .post('/api/v1/missing')
      .set('Content-Type', 'application/json')
      .send('{ invalid');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });
  it('does not serve private files', async () => {
    const response = await request(createApp({ checkDatabase: async () => {} })).get('/.env');
    expect(response.status).toBe(404);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
