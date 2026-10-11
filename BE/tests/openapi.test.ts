import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/openapi.js';

describe('assembled OpenAPI contract', () => {
  it('resolves schema references across module documents', () => {
    const missing: string[] = [];
    function visit(value: unknown) {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== 'object') return;
      for (const [key, item] of Object.entries(value)) {
        if (
          key === '$ref' &&
          typeof item === 'string' &&
          item.startsWith('#/components/schemas/')
        ) {
          const name = item.slice('#/components/schemas/'.length);
          if (!(name in openApiDocument.components.schemas)) missing.push(name);
        } else visit(item);
      }
    }
    visit(openApiDocument);
    expect(missing).toEqual([]);
  });
  it('keeps unique operations and all existing feature families', () => {
    const operations: string[] = [];
    for (const path of Object.values(openApiDocument.paths)) {
      for (const operation of Object.values(path)) {
        if (
          typeof operation === 'object' &&
          operation &&
          'operationId' in operation &&
          typeof operation.operationId === 'string'
        )
          operations.push(operation.operationId);
      }
    }
    expect(new Set(operations).size).toBe(operations.length);
    for (const path of [
      '/auth/google/start',
      '/auth/otp/request',
      '/auth/refresh',
      '/users/me',
      '/notifications',
      '/events/{id}/age-restriction',
      '/bookings/{id}/attendees',
      '/media/uploads',
      '/events',
      '/health/ready',
      '/bookings',
    ]) {
      expect(openApiDocument.paths).toHaveProperty(path);
    }
  });
});
