import type { RequestHandler, Response } from 'express';

export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

export function sendData(res: Response, data: unknown) {
  return res.json({ data, meta: { requestId: res.locals.requestId } });
}
