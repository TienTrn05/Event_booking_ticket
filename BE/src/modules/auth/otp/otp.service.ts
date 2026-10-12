import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env.js';
import { withConnection } from '../../../shared/database/pool.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { normalizeEmail, normalizePhone } from '../../../shared/validation/contact.schema.js';
import { linkingActor } from '../account/account.service.js';
import { authRepository } from '../auth.repository.js';
import { createSession } from '../session/session.service.js';
import { emailDelivery, emailOtpEnabled } from './email/email-delivery.js';
import { otpRepository } from './otp.repository.js';
import type { OtpRequestInput, OtpVerifyInput } from './otp.schema.js';

const digest = (value: string) =>
  createHmac('sha256', Buffer.from(env.OTP_HMAC_KEY ?? '', 'hex'))
    .update(value)
    .digest();
const equal = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
const invalid = () => new AppError(401, 'INVALID_OTP', 'Mã không hợp lệ, đã dùng hoặc hết hạn.');

export async function requestOtp(input: OtpRequestInput, binding: string, header?: string) {
  if (!emailOtpEnabled)
    throw new AppError(503, 'EMAIL_UNAVAILABLE', 'Gửi mã email chưa được cấu hình.');
  const actor = input.purpose === 'LINK_IDENTITY' ? await linkingActor(header) : undefined;
  const isEmail = input.identifier.includes('@');
  if ((!isEmail && input.phone) || (actor && !isEmail))
    throw new AppError(400, 'INVALID_IDENTIFIER', 'Nhập email để liên kết tài khoản.');
  const identifier = isEmail ? normalizeEmail(input.identifier) : normalizePhone(input.identifier);
  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  if (actor && identifier !== actor.email)
    throw new AppError(409, 'EMAIL_MISMATCH', 'Dùng email của phiên đăng nhập hiện tại.');
  const id = randomBytes(32);
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const target = await withTransaction(async (db) => {
    await otpRepository.lockTarget(db, identifier);
    const email = isEmail ? identifier : await authRepository.aliasEmail(db, identifier);
    if (email && email !== identifier) await otpRepository.lockTarget(db, email);
    const canonical = email ?? identifier;
    const quota = await otpRepository.quota(db, digest(`target:${canonical}`));
    if (
      quota.recent ||
      Number(quota.hourly) >= 5 ||
      Number(quota.attempts) >= 5 ||
      !(await otpRepository.globalQuota(db))
    ) {
      throw new AppError(429, 'OTP_RATE_LIMITED', 'Vui lòng chờ trước khi yêu cầu mã mới.');
    }
    await otpRepository.insert(db, {
      id,
      email: canonical,
      hash: digest(`target:${canonical}`),
      mac: digest(`code:${id.toString('base64url')}:${code}`),
      binding: digest(`browser:${binding}`),
      purpose: input.purpose,
      userId: actor?.userId,
      phone,
    });
    return email;
  });
  if (target) {
    try {
      await emailDelivery.send(target, code);
      await withConnection((db) => otpRepository.ready(db, id));
    } catch (error) {
      await withConnection((db) => otpRepository.revoke(db, id));
      throw error;
    }
  }
  return { challengeId: id.toString('base64url'), expiresIn: 300, resendAfter: 60 };
}

export async function verifyOtp(
  input: OtpVerifyInput,
  binding: string | undefined,
  requestId: string,
  header?: string,
) {
  if (!emailOtpEnabled || !binding) throw invalid();
  const id = Buffer.from(input.challengeId, 'base64url');
  const actor = header ? await linkingActor(header) : undefined;
  const result = await withTransaction(async (db) => {
    const found = await otpRepository.find(db, id);
    if (!found) return { error: invalid() };
    await otpRepository.lockTarget(db, found.target_canonical);
    const row = await otpRepository.find(db, id, true);
    if (
      !row ||
      !row.active ||
      row.used_at ||
      row.revoked_at ||
      !row.delivery_ready ||
      !equal(row.browser_binding_hash, digest(`browser:${binding}`))
    )
      return { error: invalid() };
    const quota = await otpRepository.quota(db, digest(`target:${row.target_canonical}`));
    if (row.attempts >= 5 || Number(quota.attempts) >= 5) return { error: invalid() };
    if (!equal(row.code_mac, digest(`code:${input.challengeId}:${input.code}`))) {
      await otpRepository.attempt(db, row.id);
      return { error: invalid() }; // Commit the failed attempt before returning 401.
    }
    const email = row.target_canonical;
    await authRepository.lockEmail(db, email);
    const existing = await authRepository.emailAccount(db, email);
    const googleOwners = await authRepository.googleEmailOwners(db, email);
    if (row.purpose === 'LINK_IDENTITY') {
      if (!actor || row.user_id !== actor.userId || actor.email !== email)
        return {
          error: new AppError(
            401,
            'REAUTHENTICATION_REQUIRED',
            'Đăng nhập lại trước khi liên kết.',
          ),
        };
      const current = await authRepository.linkActor(db, actor.userId, actor.sessionId);
      if (!current || !current.recent || current.email !== email)
        return {
          error: new AppError(
            401,
            'REAUTHENTICATION_REQUIRED',
            'Đăng nhập lại trước khi liên kết.',
          ),
        };
      if (
        (existing && existing.user_id !== actor.userId) ||
        googleOwners.some((owner) => owner.user_id !== actor.userId)
      )
        return { error: new AppError(409, 'IDENTITY_CONFLICT', 'Email đã thuộc tài khoản khác.') };
    } else if (!existing && googleOwners.length) {
      await otpRepository.consume(db, row.id);
      return {
        error: new AppError(
          409,
          'LINK_REQUIRED',
          'Email đã dùng với Google. Đăng nhập Google rồi bật email/SĐT trong tài khoản.',
        ),
      };
    }
    if (existing && (existing.revoked_at || existing.status !== 'ACTIVE'))
      return { error: new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản không khả dụng.') };
    const linkedActor = row.purpose === 'LINK_IDENTITY' ? actor : undefined;
    let userId = existing?.user_id ?? linkedActor?.userId;
    if (!userId) {
      const created = await authRepository.createEmailUser(db);
      userId = created.userId;
    }
    const identityId =
      existing?.identity_id ?? (await authRepository.addEmailIdentity(db, userId, email));
    if (row.login_phone) {
      if (existing && row.purpose !== 'LINK_IDENTITY')
        return {
          error: new AppError(
            409,
            'LINK_REQUIRED',
            'Đăng nhập bằng email rồi thêm SĐT trong tài khoản.',
          ),
        };
      if (!(await authRepository.addPhoneAlias(db, row.login_phone, identityId)))
        throw new AppError(
          409,
          'PHONE_CONFLICT',
          'SĐT đã được dùng làm tên đăng nhập của tài khoản khác.',
        );
    }
    await otpRepository.consume(db, row.id);
    if (linkedActor)
      await authRepository.audit(db, userId, 'auth.email.link', linkedActor.sessionId, requestId);
    const account = await authRepository.emailAccount(db, email);
    const session = await createSession(
      db,
      {
        userId,
        identityId,
        displayName: account!.display_name,
        authVersion: account!.auth_version,
      },
      requestId,
      'auth.email.login',
    );
    return { session };
  });
  if (result.error) throw result.error;
  return result.session!;
}
