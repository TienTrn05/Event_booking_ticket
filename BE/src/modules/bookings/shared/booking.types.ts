import type { Request } from 'express';
import type { RequestActor } from '../../../shared/auth/request-actor.js';

export type AdmissionGate = (
  req: Request,
  actor: RequestActor,
  publicId: string,
  sessionId: string,
) => Promise<void>;
