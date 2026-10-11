import type { RequestHandler } from 'express';
import { randomBytes } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error.js';
import { sendData as send } from '../../../shared/http/response.js';
import {
  accessToken,
  authCookieOptions,
  authEnabled,
  currentMethods,
  currentUser,
  logout,
  refreshMaxAge,
  rotateRefresh,
  sessionEnabled,
} from '../auth.service.js';
import {
  clearRefresh,
  cookieValue,
  csrfName,
  refreshName,
  requireBrowser,
  setRefresh,
} from '../http/auth.http.js';
import { emailOtpEnabled } from '../otp/email/email-delivery.js';
export function createSessionController() {
  const configHandler: RequestHandler = (_req, res) =>
    send(res, { googleEnabled: authEnabled, emailOtpEnabled, sessionEnabled });

  const csrfHandler: RequestHandler = (req, res) => {
    if (!sessionEnabled)
      throw new AppError(503, 'AUTH_UNAVAILABLE', 'Đăng nhập chưa được cấu hình.');
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
  };

  const refreshHandler: RequestHandler = async (req, res) => {
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
  };

  const logoutHandler: RequestHandler = async (req, res) => {
    requireBrowser(req);
    await logout(cookieValue(req.headers.cookie, refreshName), String(res.locals.requestId));
    clearRefresh(res);
    return res.status(204).end();
  };

  const meHandler: RequestHandler = async (req, res) =>
    send(res, await currentUser(req.get('authorization')));

  const methodsHandler: RequestHandler = async (req, res) =>
    send(res, await currentMethods(req.get('authorization')));
  return {
    config: configHandler,
    csrf: csrfHandler,
    refresh: refreshHandler,
    logout: logoutHandler,
    me: meHandler,
    methods: methodsHandler,
  };
}
