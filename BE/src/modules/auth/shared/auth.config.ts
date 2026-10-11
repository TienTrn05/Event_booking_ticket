import { OAuth2Client } from 'google-auth-library';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';

export const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET ?? '');

export const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI
    ? new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI)
    : null;

export const sessionEnabled = Boolean(env.PUBLIC_APP_URL && secret.length >= 32);

export const authEnabled = Boolean(google && sessionEnabled);

export const day = 24 * 60 * 60 * 1000;

export const stateTtl = 5 * 60 * 1000;

export function config() {
  if (
    !authEnabled ||
    !google ||
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_REDIRECT_URI ||
    !env.PUBLIC_APP_URL
  ) {
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'Đăng nhập Google chưa được cấu hình.');
  }
  return {
    google,
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    appUrl: env.PUBLIC_APP_URL,
  };
}

export function requireSessionConfig() {
  if (!sessionEnabled) throw new AppError(503, 'AUTH_UNAVAILABLE', 'Đăng nhập chưa được cấu hình.');
}

export function authCookieOptions() {
  const secure = env.APP_ENV !== 'development' && env.APP_ENV !== 'testing';
  return { secure, sameSite: 'lax' as const };
}

export const authStateMaxAge = stateTtl;

export const refreshMaxAge = 7 * day;
