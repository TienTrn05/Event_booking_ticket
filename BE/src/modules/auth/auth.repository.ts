import { identityRepository } from './account/identity.repository.js';
import { sessionRepository } from './session/session.repository.js';
import { authAuditRepository } from './shared/auth-audit.repository.js';
export type { GoogleIdentityRow, RefreshRow } from './shared/auth.repository.types.js';
export const authRepository = {
  ...identityRepository,
  ...sessionRepository,
  ...authAuditRepository,
};
