import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

/** Prevent unsupported bodies from being silently treated as an empty JSON object. */
export const requireJsonRequest: RequestHandler = (req, _res, next) => {
  const hasBody =
    req.headers['transfer-encoding'] !== undefined || Number(req.get('content-length') ?? 0) > 0;
  if (
    hasBody &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
    !req.is('application/json')
  ) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Nội dung yêu cầu phải là application/json.');
  }
  next();
};
