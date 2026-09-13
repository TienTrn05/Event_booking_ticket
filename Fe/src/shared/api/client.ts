const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
if (!baseUrl.startsWith('/') || baseUrl.startsWith('//') || baseUrl.includes('\\')) {
  throw new Error('VITE_API_BASE_URL must be a same-origin path.');
}
export class ApiError extends Error {
  constructor(public readonly status: number) {
    super('Không thể hoàn tất yêu cầu.');
  }
}
// No token storage, automatic payment retries or implicit authorization.
// Callers validate unknown response data against their domain schema.
export async function apiRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    throw new Error('Invalid API path');
  const headers = new Headers(options.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    credentials: 'same-origin',
    headers,
  });
  if (!response.ok) throw new ApiError(response.status);
  if (response.status === 204) return undefined;
  return response.json() as Promise<unknown>;
}
