import type { RequestHandler } from 'express';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { sendData as send } from '../../../shared/http/response.js';
import {
  appReturnUrl,
  authCookieOptions,
  authEnabled,
  authStateMaxAge,
  finishGoogle,
  linkingActor,
  recordGoogleFailure,
  startGoogle,
} from '../auth.service.js';
import { cookieValue, requireBrowser, setRefresh, stateName } from '../http/auth.http.js';
import { googleCallbackQuery, googleStartInput } from './google.schema.js';
export function createGoogleController() {
  const startGoogleHandler: RequestHandler = async (req, res) => {
    requireBrowser(req);
    const body = googleStartInput.parse(req.body ?? {});
    const actor = body.link ? await linkingActor(req.get('authorization')) : undefined;
    const { url, stateCookie } = startGoogle(actor);
    res.cookie(stateName, stateCookie, {
      ...authCookieOptions(),
      httpOnly: true,
      path: '/api/v1/auth/google',
      maxAge: authStateMaxAge,
    });
    return send(res, { authorizationUrl: url });
  };

  const googleCallbackHandler: RequestHandler = async (req, res) => {
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
      const query = googleCallbackQuery.parse(req.query);
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
  };
  return { startGoogle: startGoogleHandler, googleCallback: googleCallbackHandler };
}
