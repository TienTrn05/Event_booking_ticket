import type { Request } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';
export function requireAppOrigin(req: Request) {
  if (!env.PUBLIC_APP_URL || req.get('origin') !== new URL(env.PUBLIC_APP_URL).origin)
    throw new AppError(403, 'INVALID_ORIGIN', 'Yêu cầu không hợp lệ.');
}
