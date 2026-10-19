import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
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
  const validation = error instanceof ZodError;
  const status =
    error instanceof AppError
      ? error.status
      : validation || malformed
        ? 400
        : oversized
          ? 413
          : 500;
  res.status(status).json({
    error: {
      code:
        error instanceof AppError
          ? error.code
          : validation
            ? 'VALIDATION_ERROR'
            : malformed
              ? 'INVALID_JSON'
              : oversized
                ? 'PAYLOAD_TOO_LARGE'
                : 'INTERNAL_ERROR',
      message:
        error instanceof AppError
          ? error.message
          : validation
            ? 'Dữ liệu yêu cầu không hợp lệ.'
            : status === 500
              ? 'Có lỗi xảy ra. Vui lòng thử lại.'
              : 'Nội dung yêu cầu không hợp lệ.',
      ...(error instanceof AppError && error.details
        ? { details: error.details }
        : validation
          ? {
              details: error.issues.map((issue) => ({
                field: issue.path.join('.') || 'request',
                code: 'INVALID',
              })),
            }
          : {}),
    },
    meta: { requestId: res.locals.requestId },
  });
};
