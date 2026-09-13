import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, ApiError } from '../src/shared/api/client';

afterEach(() => vi.unstubAllGlobals());

describe('API client transport', () => {
  it.each([
    new Headers({ 'X-Request-Context': 'fixture' }),
    [['X-Request-Context', 'fixture']] as [string, string][],
    { 'X-Request-Context': 'fixture' },
  ])('preserves every supported HeadersInit shape', async (headers) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/health/live', { headers });
    const options = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(options?.headers).get('X-Request-Context')).toBe('fixture');
    expect(new Headers(options?.headers).get('Accept')).toBe('application/json');
    expect(options?.credentials).toBe('same-origin');
  });

  it('returns no body for 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiRequest('/fixture')).resolves.toBeUndefined();
  });

  it('does not automatically retry or expose server error bodies', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('internal database detail', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/fixture')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an external URL before sending a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('//outside.example/collect')).rejects.toThrow('Invalid API path');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
