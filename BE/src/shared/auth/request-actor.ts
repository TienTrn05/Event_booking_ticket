import type { Request } from 'express';
import { AppError } from '../errors/app-error.js';

/** Verified server-side session context, never populated from request body. */
export type RequestActor = { id: string; sessionId: string; authVersion: number };

export function createActorContext() {
  const actors = new WeakMap<Request, RequestActor>();
  return {
    set: (req: Request, actor: RequestActor) => actors.set(req, actor),
    get(req: Request): RequestActor {
      const actor = actors.get(req);
      if (!actor) throw new AppError(401, 'UNAUTHENTICATED', 'Cần đăng nhập.');
      return actor;
    },
  };
}
