import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import { env } from '../../../../config/env.js';
import { AppError } from '../../../../shared/errors/app-error.js';
import { otpEmailContent } from './otp-email.template.js';

export const emailOtpEnabled = Boolean(
  env.SMTP_USER &&
  env.SMTP_PASSWORD &&
  env.OTP_HMAC_KEY &&
  env.PUBLIC_APP_URL &&
  env.JWT_ACCESS_SECRET,
);
let transport: Transporter | undefined;
function smtpTransport() {
  transport ??= nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    logger: false,
    debug: false,
  });
  return transport;
}
export const emailDelivery = {
  async send(to: string, code: string) {
    if (!emailOtpEnabled)
      throw new AppError(503, 'EMAIL_UNAVAILABLE', 'Gửi mã email chưa được cấu hình.');
    try {
      await smtpTransport().sendMail({
        from: { name: 'Eventix', address: env.SMTP_USER! },
        to,
        subject: 'Mã xác minh Eventix',
        ...otpEmailContent(code),
      });
    } catch {
      // Never expose credentials, recipient details, message content or raw SMTP errors.
      throw new AppError(503, 'EMAIL_UNAVAILABLE', 'Chưa thể gửi mã email. Vui lòng thử lại sau.');
    }
  },
};
