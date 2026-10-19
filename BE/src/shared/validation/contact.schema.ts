import { z } from 'zod';

export function normalizeEmail(value: string) {
  return z.email().max(254).parse(value.trim().toLowerCase());
}

export function normalizePhone(value: string) {
  let phone = value.trim().replace(/[\s().-]/g, '');
  if (/^0[35789]\d{8}$/.test(phone)) phone = `+84${phone.slice(1)}`;
  return z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/)
    .parse(phone);
}
