import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { authCookieOptions } from '../shared/auth.config.js';
export const stateName = 'eventix.oauth';

export const refreshName = 'eventix.refresh';

export const csrfName = 'eventix.csrf';

export const otpBrowserName = 'eventix.otp-browser';

export const cookieValue = (header: string | undefined, name: string) => {
  const value = header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return value?.slice(name.length + 1);
};

export const same = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export function requireBrowser(req: Request) {
  requireAppOrigin(req);
  const cookie = cookieValue(req.headers.cookie, csrfName);
  const header = req.get('x-csrf-token');
  if (!cookie || !header || !same(cookie, header))
    throw new AppError(403, 'INVALID_CSRF', 'Yêu cầu không hợp lệ.');
}

export function setRefresh(res: Response, token: string, expiresAt: Date) {
  res.cookie(refreshName, token, {
    ...authCookieOptions(),
    httpOnly: true,
    path: '/api/v1/auth',
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

export function clearRefresh(res: Response) {
  res.clearCookie(refreshName, { ...authCookieOptions(), httpOnly: true, path: '/api/v1/auth' });
}
