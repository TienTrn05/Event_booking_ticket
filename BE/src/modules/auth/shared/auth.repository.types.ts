export interface GoogleIdentityRow {
  user_id: string;
  identity_id: string;
  display_name: string;
  status: string;
  auth_version: number;
  revoked_at: Date | null;
}
export interface RefreshRow {
  id: string;
  session_id: string;
  used_at: Date | null;
  revoked_at: Date | null;
  user_id: string;
  identity_id: string;
  display_name: string;
  status: string;
  auth_version: number;
  session_revoked_at: Date | null;
  session_expires_at: Date;
  token_active: boolean;
  session_active: boolean;
  identity_active: boolean;
}
