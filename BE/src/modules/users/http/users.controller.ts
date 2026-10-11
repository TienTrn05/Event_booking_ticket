import type { RequestHandler } from 'express';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { sendData } from '../../../shared/http/response.js';
import { authenticatedUser } from '../../auth/auth.service.js';
import { updateProfileSchema } from '../schemas/users.schema.js';
import { getProfile, updateProfile } from '../services/users.service.js';

export function createUsersController() {
  const getProfileHandler: RequestHandler = async (req, res) => {
    const actor = await authenticatedUser(req.get('authorization'));
    const data = await getProfile(actor);
    sendData(res, data);
  };

  const updateProfileHandler: RequestHandler = async (req, res) => {
    requireAppOrigin(req);
    const actor = await authenticatedUser(req.get('authorization'));
    const input = updateProfileSchema.parse(req.body);
    const data = await updateProfile(actor, input, String(res.locals.requestId));
    sendData(res, data);
  };
  return { getProfile: getProfileHandler, updateProfile: updateProfileHandler };
}
