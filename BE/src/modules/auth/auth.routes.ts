import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  accessToken,
  appReturnUrl,
  authCookieOptions,
  authEnabled,
  authStateMaxAge,
  currentUser,
  currentMethods,
  finishGoogle,
  logout,
  recordGoogleFailure,
  refreshMaxAge,
  rotateRefresh,
  startGoogle,
  sessionEnabled,
  linkingActor,
} from './auth.service.js';
import { emailOtpEnabled } from './email-delivery.js';
import { otpRequestSchema, otpVerifySchema, requestOtp, verifyOtp } from './otp.service.js';

const router = Router();
const authLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const stateName = 'eventix.oauth';
const refreshName = 'eventix.refresh';
const csrfName = 'eventix.csrf';
const otpBrowserName = 'eventix.otp-browser';
const otpSendLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const cookieValue = (header: string | undefined, name: string) => {
  const value = header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return value?.slice(name.length + 1);
};
const same = (left: string, right: string) => {
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
function requireBrowser(req: Parameters<Parameters<typeof router.post>[1]>[0]) {
  if (!env.PUBLIC_APP_URL || req.get('origin') !== new URL(env.PUBLIC_APP_URL).origin) {
    throw new AppError(403, 'INVALID_ORIGIN', 'Yêu cầu không hợp lệ.');
  }
  const cookie = cookieValue(req.headers.cookie, csrfName);
  const header = req.get('x-csrf-token');
  if (!cookie || !header || !same(cookie, header))
    throw new AppError(403, 'INVALID_CSRF', 'Yêu cầu không hợp lệ.');
}
function setRefresh(
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  token: string,
  expiresAt: Date,
) {
  res.cookie(refreshName, token, {
    ...authCookieOptions(),
    httpOnly: true,
    path: '/api/v1/auth',
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}
function clearRefresh(res: Parameters<Parameters<typeof router.get>[1]>[1]) {
  res.clearCookie(refreshName, { ...authCookieOptions(), httpOnly: true, path: '/api/v1/auth' });
}
const send = (res: Parameters<Parameters<typeof router.get>[1]>[1], data: unknown) =>
  res.json({ data, meta: { requestId: res.locals.requestId } });

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.get('/config', (_req, res) =>
  send(res, { googleEnabled: authEnabled, emailOtpEnabled, sessionEnabled }),
);
router.get('/csrf', (req, res) => {
  if (!sessionEnabled) throw new AppError(503, 'AUTH_UNAVAILABLE', 'Đăng nhập chưa được cấu hình.');
  if (req.get('sec-fetch-site') === 'cross-site')
    throw new AppError(403, 'INVALID_ORIGIN', 'Yêu cầu không hợp lệ.');
  const token = randomBytes(32).toString('base64url');
  res.cookie(csrfName, token, {
    ...authCookieOptions(),
    httpOnly: true,
    path: '/api/v1/auth',
    maxAge: refreshMaxAge,
  });
  return send(res, { csrfToken: token });
});
router.post('/google/start', authLimit, async (req, res) => {
  requireBrowser(req);
  const body = z
    .object({ link: z.boolean().optional() })
    .strict()
    .parse(req.body ?? {});
  const actor = body.link ? await linkingActor(req.get('authorization')) : undefined;
  const { url, stateCookie } = startGoogle(actor);
  res.cookie(stateName, stateCookie, {
    ...authCookieOptions(),
    httpOnly: true,
    path: '/api/v1/auth/google',
    maxAge: authStateMaxAge,
  });
  return send(res, { authorizationUrl: url });
});
router.post('/otp/request', otpSendLimit, async (req, res) => {
  requireBrowser(req);
  const input = otpRequestSchema.parse(req.body);
  let binding = cookieValue(req.headers.cookie, otpBrowserName);
  if (!binding || !/^[A-Za-z0-9_-]{43}$/.test(binding))
    binding = randomBytes(32).toString('base64url');
  res.cookie(otpBrowserName, binding, {
    ...authCookieOptions(),
    httpOnly: true,
    path: '/api/v1/auth',
    maxAge: refreshMaxAge,
  });
  let result;
  try {
    result = await requestOtp(input, binding, req.get('authorization'));
  } catch (error) {
    await recordGoogleFailure(String(res.locals.requestId), error, 'auth.email.failure');
    throw error;
  }
  res.status(202);
  return send(res, result);
});
router.post('/otp/verify', authLimit, async (req, res) => {
  requireBrowser(req);
  let session;
  try {
    session = await verifyOtp(
      otpVerifySchema.parse(req.body),
      cookieValue(req.headers.cookie, otpBrowserName),
      String(res.locals.requestId),
      req.get('authorization'),
    );
  } catch (error) {
    await recordGoogleFailure(String(res.locals.requestId), error, 'auth.email.failure');
    throw error;
  }
  setRefresh(res, session.refreshToken, session.expiresAt);
  return send(res, {
    accessToken: await accessToken(session),
    user: { id: session.userId, displayName: session.displayName },
  });
});
router.get('/google/callback', async (req, res) => {
  if (!authEnabled)
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'Đăng nhập Google chưa được cấu hình.');
  const stateCookie = cookieValue(req.headers.cookie, stateName);
  res.clearCookie(stateName, {
    ...authCookieOptions(),
    httpOnly: true,
    path: '/api/v1/auth/google',
  });
  try {
    if (req.query.error === 'access_denied')
      throw new AppError(401, 'GOOGLE_CANCELLED', 'Bạn đã hủy đăng nhập Google.');
    const query = z
      .object({ code: z.string().min(1).max(2048), state: z.string().min(1).max(256) })
      .parse(req.query);
    const session = await finishGoogle(
      query.code,
      query.state,
      stateCookie,
      String(res.locals.requestId),
    );
    setRefresh(res, session.refreshToken, session.expiresAt);
    return res.redirect(302, appReturnUrl('success'));
  } catch (error) {
    if (env.NODE_ENV !== 'test') await recordGoogleFailure(String(res.locals.requestId), error);
    return res.redirect(
      302,
      appReturnUrl('error', error instanceof AppError ? error.code : undefined),
    );
  }
});
router.post('/refresh', authLimit, async (req, res) => {
  requireBrowser(req);
  const token = cookieValue(req.headers.cookie, refreshName);
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Cần đăng nhập.');
  try {
    const session = await rotateRefresh(token, String(res.locals.requestId));
    setRefresh(res, session.refreshToken, session.expiresAt);
    return send(res, {
      accessToken: await accessToken(session),
      user: { id: session.userId, displayName: session.displayName },
    });
  } catch (error) {
    clearRefresh(res);
    throw error;
  }
});
router.post('/logout', async (req, res) => {
  requireBrowser(req);
  await logout(cookieValue(req.headers.cookie, refreshName), String(res.locals.requestId));
  clearRefresh(res);
  return res.status(204).end();
});
router.get('/me', async (req, res) => send(res, await currentUser(req.get('authorization'))));
router.get('/methods', async (req, res) =>
  send(res, await currentMethods(req.get('authorization'))),
);

export function createAuthRouter() {
  return router;
}
