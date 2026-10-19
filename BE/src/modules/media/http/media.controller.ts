import type { Request, RequestHandler } from 'express';
import { r2Config } from '../../../config/r2.js';
import { sendData } from '../../../shared/http/response.js';
import { authenticatedUser } from '../../auth/auth.service.js';
import { completeUploadInput, uploadSchema, type MediaActor } from '../schemas/media.schema.js';
import { completeImageUpload, createImageUpload, getAvatar } from '../services/media.service.js';

export function createMediaController(actorFor: (req: Request) => MediaActor) {
  const configHandler: RequestHandler = (_req, res) =>
    res.json({ data: { enabled: Boolean(r2Config) }, meta: { requestId: res.locals.requestId } });

  const avatarHandler: RequestHandler = async (req, res) => {
    const actor = await authenticatedUser(req.get('authorization'));
    const avatarUrl = await getAvatar(actor);
    res.json({ data: { avatarUrl }, meta: { requestId: res.locals.requestId } });
  };

  const createUploadHandler: RequestHandler = async (req, res) => {
    const actor = actorFor(req);
    const data = await createImageUpload(actor, uploadSchema.parse(req.body));
    sendData(res, data);
  };

  const completeUploadHandler: RequestHandler = async (req, res) => {
    const actor = actorFor(req);
    const { uploadToken } = completeUploadInput.parse(req.body);
    const data = await completeImageUpload(actor, uploadToken, String(res.locals.requestId));
    sendData(res, data);
  };
  return {
    config: configHandler,
    avatar: avatarHandler,
    createUpload: createUploadHandler,
    completeUpload: completeUploadHandler,
  };
}
