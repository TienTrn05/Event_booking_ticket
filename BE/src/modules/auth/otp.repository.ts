import type { PoolClient } from 'pg';

export interface OtpRow {
  id: string;
  challenge_id: Buffer;
  target_canonical: string;
  code_mac: Buffer;
  user_id: string | null;
  browser_binding_hash: Buffer;
  purpose: string;
  login_phone: string | null;
  delivery_ready: boolean;
  attempts: number;
  active: boolean;
  used_at: Date | null;
  revoked_at: Date | null;
}
export const otpRepository = {
  async lockTarget(db: PoolClient, target: string) {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`OTP:${target}`]);
  },
  async quota(db: PoolClient, targetHash: Buffer) {
    const { rows } = await db.query<{ recent: boolean; hourly: string; attempts: string }>(
      `SELECT COALESCE(bool_or(created_at > CURRENT_TIMESTAMP - INTERVAL '60 seconds'),false) AS recent,
       count(*)::text AS hourly, COALESCE(sum(CASE WHEN created_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN attempts ELSE 0 END),0)::text AS attempts
       FROM otp_challenges WHERE channel='EMAIL' AND target_hash=$1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'`,
      [targetHash],
    );
    return rows[0]!;
  },
  async globalQuota(db: PoolClient) {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('OTP:GLOBAL',0))");
    const { rows } = await db.query<{ count: string }>(
      `SELECT count(*)::text FROM otp_challenges WHERE channel='EMAIL' AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'`,
    );
    return Number(rows[0]!.count) < 100;
  },
  async insert(
    db: PoolClient,
    values: {
      id: Buffer;
      email: string;
      hash: Buffer;
      mac: Buffer;
      userId?: string | undefined;
      binding: Buffer;
      phone?: string | undefined;
      purpose: string;
    },
  ) {
    await db.query(
      `UPDATE otp_challenges SET revoked_at=CURRENT_TIMESTAMP WHERE channel='EMAIL' AND target_hash=$1 AND used_at IS NULL AND revoked_at IS NULL`,
      [values.hash],
    );
    await db.query(
      `INSERT INTO otp_challenges(challenge_id,channel,purpose,target_canonical,target_hash,code_mac,mac_key_version,user_id,browser_binding_hash,expires_at,login_phone)
      VALUES ($1,'EMAIL',$2,$3,$4,$5,'v1',$6,$7,CURRENT_TIMESTAMP + INTERVAL '5 minutes',$8)`,
      [
        values.id,
        values.purpose,
        values.email,
        values.hash,
        values.mac,
        values.userId ?? null,
        values.binding,
        values.phone ?? null,
      ],
    );
  },
  async ready(db: PoolClient, id: Buffer) {
    await db.query(
      'UPDATE otp_challenges SET delivery_ready=TRUE WHERE challenge_id=$1 AND revoked_at IS NULL',
      [id],
    );
  },
  async revoke(db: PoolClient, id: Buffer) {
    await db.query('UPDATE otp_challenges SET revoked_at=CURRENT_TIMESTAMP WHERE challenge_id=$1', [
      id,
    ]);
  },
  async find(db: PoolClient, id: Buffer, lock = false) {
    const { rows } = await db.query<OtpRow>(
      `SELECT id::text,challenge_id,target_canonical,code_mac,user_id::text,browser_binding_hash,purpose,
      login_phone,delivery_ready,attempts,used_at,revoked_at,expires_at > CURRENT_TIMESTAMP AS active
      FROM otp_challenges WHERE challenge_id=$1 AND channel='EMAIL' ${lock ? 'FOR UPDATE' : ''}`,
      [id],
    );
    return rows[0];
  },
  async attempt(db: PoolClient, id: string) {
    await db.query(
      'UPDATE otp_challenges SET attempts=attempts+1 WHERE id=$1 AND attempts < max_attempts',
      [id],
    );
  },
  async consume(db: PoolClient, id: string) {
    await db.query('UPDATE otp_challenges SET used_at=CURRENT_TIMESTAMP WHERE id=$1', [id]);
  },
};
