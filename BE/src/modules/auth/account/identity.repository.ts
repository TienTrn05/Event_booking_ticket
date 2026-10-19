import type { PoolClient } from 'pg';
import type { GoogleIdentityRow } from '../shared/auth.repository.types.js';
export const identityRepository = {
  async loginMethods(db: PoolClient, userId: string) {
    const identities = await db.query<{ provider: string; email: string | null }>(
      `SELECT provider,email_canonical AS email FROM external_identities WHERE user_id=$1 AND revoked_at IS NULL AND provider IN ('GOOGLE','EMAIL') ORDER BY CASE WHEN provider='EMAIL' THEN 0 ELSE 1 END,id`,
      [userId],
    );
    const aliases = await db.query<{ phone: string }>(
      `SELECT a.phone FROM phone_login_aliases a JOIN external_identities i ON i.id=a.email_identity_id WHERE i.user_id=$1 AND i.provider='EMAIL' AND i.revoked_at IS NULL ORDER BY a.phone`,
      [userId],
    );
    return {
      email: identities.rows.find((row) => row.email)?.email ?? null,
      googleLinked: identities.rows.some((row) => row.provider === 'GOOGLE'),
      emailLinked: identities.rows.some((row) => row.provider === 'EMAIL'),
      phones: aliases.rows.map((row) => row.phone),
    };
  },
  async lockEmail(db: PoolClient, email: string) {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`EMAIL:${email}`]);
  },
  async emailAccount(db: PoolClient, email: string) {
    const { rows } = await db.query<GoogleIdentityRow>(
      `SELECT u.id::text AS user_id, i.id::text AS identity_id, u.display_name, u.status, u.auth_version, i.revoked_at
       FROM external_identities i JOIN users u ON u.id=i.user_id WHERE i.provider='EMAIL' AND i.subject=$1 FOR UPDATE OF i,u`,
      [email],
    );
    return rows[0];
  },
  async googleEmailOwners(db: PoolClient, email: string) {
    const { rows } = await db.query<{ user_id: string }>(
      `SELECT DISTINCT user_id::text FROM external_identities WHERE provider='GOOGLE' AND email_canonical=$1`,
      [email],
    );
    return rows;
  },
  async linkActor(db: PoolClient, userId: string, sessionId: string) {
    const { rows } = await db.query<{
      id: string;
      display_name: string;
      auth_version: number;
      provider: string;
      email: string | null;
      recent: boolean;
    }>(
      `SELECT u.id::text, u.display_name, u.auth_version, i.provider, i.email_canonical AS email,
       s.authenticated_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes' AS recent
       FROM users u JOIN auth_sessions s ON s.user_id=u.id JOIN external_identities i ON i.id=s.identity_id
       WHERE u.id=$1 AND s.id=$2 AND u.status='ACTIVE' AND s.revoked_at IS NULL
       AND s.expires_at > CURRENT_TIMESTAMP AND i.revoked_at IS NULL FOR UPDATE OF u,s,i`,
      [userId, sessionId],
    );
    return rows[0];
  },
  async addGoogleIdentity(
    db: PoolClient,
    userId: string,
    subject: string,
    email: string,
    hd: string | null,
  ) {
    await db.query(
      `INSERT INTO external_identities (user_id,provider,subject,email_canonical,email_verified_at,hosted_domain,verified_at)
      VALUES ($1,'GOOGLE',$2,$3,CURRENT_TIMESTAMP,$4,CURRENT_TIMESTAMP)`,
      [userId, subject, email, hd],
    );
  },
  async addEmailIdentity(db: PoolClient, userId: string, email: string) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO external_identities
      (user_id,provider,subject,email_canonical,email_verified_at,verified_at)
      VALUES ($1,'EMAIL',$2,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id::text`,
      [userId, email],
    );
    return rows[0]!.id;
  },
  async createEmailUser(db: PoolClient) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO users(display_name) VALUES ('Người dùng Eventix') RETURNING id::text`,
    );
    const userId = rows[0]!.id;
    return { userId };
  },
  async aliasEmail(db: PoolClient, phone: string) {
    const { rows } = await db.query<{ email: string }>(
      `SELECT i.subject AS email FROM phone_login_aliases a
      JOIN external_identities i ON i.id=a.email_identity_id WHERE a.phone=$1 AND i.provider='EMAIL' AND i.revoked_at IS NULL`,
      [phone],
    );
    return rows[0]?.email;
  },
  async addPhoneAlias(db: PoolClient, phone: string, identityId: string) {
    const { rows } = await db.query<{ email_identity_id: string }>(
      `INSERT INTO phone_login_aliases(phone,email_identity_id)
      VALUES ($1,$2) ON CONFLICT(phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING email_identity_id::text`,
      [phone, identityId],
    );
    return rows[0]!.email_identity_id === identityId;
  },
  async lockGoogleSubject(db: PoolClient, subject: string) {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`GOOGLE:${subject}`]);
  },
  async googleIdentity(db: PoolClient, subject: string): Promise<GoogleIdentityRow | undefined> {
    const { rows } = await db.query<GoogleIdentityRow>(
      `SELECT u.id::text AS user_id, i.id::text AS identity_id, u.display_name, u.status, u.auth_version, i.revoked_at
       FROM external_identities i JOIN users u ON u.id = i.user_id
       WHERE i.provider = 'GOOGLE' AND i.subject = $1 FOR UPDATE OF i, u`,
      [subject],
    );
    return rows[0];
  },
  async updateGoogleIdentity(
    db: PoolClient,
    id: string,
    email: string | null,
    verified: boolean,
    hostedDomain: string | null,
  ) {
    await db.query(
      `UPDATE external_identities SET verified_at = CURRENT_TIMESTAMP, email_canonical = $2,
       email_verified_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE NULL END, hosted_domain = $4 WHERE id = $1`,
      [id, email, verified, hostedDomain],
    );
  },
  async createGoogleAccount(
    db: PoolClient,
    subject: string,
    name: string,
    email: string | null,
    verified: boolean,
    hostedDomain: string | null,
  ) {
    const user = await db.query<{ id: string }>(
      'INSERT INTO users (display_name) VALUES ($1) RETURNING id::text',
      [name],
    );
    const userId = user.rows[0]!.id;
    const identity = await db.query<{ id: string }>(
      `INSERT INTO external_identities (user_id, provider, subject, email_canonical, email_verified_at, hosted_domain, verified_at)
       VALUES ($1, 'GOOGLE', $2, $3, CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE NULL END, $5, CURRENT_TIMESTAMP)
       RETURNING id::text`,
      [userId, subject, email, verified, hostedDomain],
    );
    return { userId, identityId: identity.rows[0]!.id };
  },
};
