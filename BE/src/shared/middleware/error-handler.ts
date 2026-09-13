import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const malformed =
    error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed';
  const oversized =
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large';
  const status = error instanceof AppError ? error.status : malformed ? 400 : oversized ? 413 : 500;
  res.status(status).json({
    error: {
      code:
        error instanceof AppError
          ? error.code
          : malformed
            ? 'INVALID_JSON'
            : oversized
              ? 'PAYLOAD_TOO_LARGE'
              : 'INTERNAL_ERROR',
      message:
        error instanceof AppError
          ? error.message
          : status === 500
            ? 'Có lỗi xảy ra. Vui lòng thử lại.'
            : 'Nội dung yêu cầu không hợp lệ.',
    },
    meta: { requestId: res.locals.requestId },
  });
};
