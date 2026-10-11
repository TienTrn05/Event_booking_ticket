import type { RequestHandler } from 'express';
import { randomBytes } from 'node:crypto';
import { sendData as send } from '../../../shared/http/response.js';
import {
  accessToken,
  authCookieOptions,
  recordGoogleFailure,
  refreshMaxAge,
} from '../auth.service.js';
import { cookieValue, otpBrowserName, requireBrowser, setRefresh } from '../http/auth.http.js';
import { otpRequestSchema, otpVerifySchema } from './otp.schema.js';
import { requestOtp, verifyOtp } from './otp.service.js';
export function createOtpController() {
  const requestOtpHandler: RequestHandler = async (req, res) => {
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
  };

  const verifyOtpHandler: RequestHandler = async (req, res) => {
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
  };
  return { requestOtp: requestOtpHandler, verifyOtp: verifyOtpHandler };
}
