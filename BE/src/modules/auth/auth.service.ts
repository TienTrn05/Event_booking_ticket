// Public entry point for session/auth operations used by other modules.
export {
  currentMethods,
  currentUser,
  linkingActor,
  recordGoogleFailure,
} from './account/account.service.js';
export { appReturnUrl, finishGoogle, startGoogle } from './google/google.service.js';
export {
  accessToken,
  authenticatedUser,
  createSession,
  logout,
  logoutAll,
  listSessions,
  revokeOwnedSession,
  rotateRefresh,
} from './session/session.service.js';
export {
  authCookieOptions,
  authEnabled,
  authStateMaxAge,
  refreshMaxAge,
  sessionEnabled,
} from './shared/auth.config.js';
export type { Account, Session } from './shared/auth.types.js';
