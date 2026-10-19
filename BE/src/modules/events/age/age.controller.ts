import type { RequestHandler } from 'express';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { sendData } from '../../../shared/http/response.js';
import { numericId, publicId } from '../../../shared/validation/common.schema.js';
import { authenticatedUser } from '../../auth/auth.service.js';
import { ageEligibilityInput, ageRestrictionInput } from './age.schema.js';
import { ageEligibility, updateAgeRestriction } from './age.service.js';

export const updateRestriction: RequestHandler = async (req, res) => {
  requireAppOrigin(req);
  const actor = await authenticatedUser(req.get('authorization'));
  const data = await updateAgeRestriction(
    actor,
    numericId.parse(req.params.id),
    ageRestrictionInput.parse(req.body),
    String(res.locals.requestId),
  );
  res.setHeader('Cache-Control', 'no-store');
  sendData(res, data);
};

export const checkEligibility: RequestHandler = async (req, res) => {
  requireAppOrigin(req);
  const actor = await authenticatedUser(req.get('authorization'));
  const input = ageEligibilityInput.parse(req.body ?? {});
  const data = await ageEligibility(
    actor,
    publicId.parse(req.params.id),
    numericId.parse(req.params.sessionId),
    input.dateOfBirth,
  );
  res.setHeader('Cache-Control', 'no-store');
  sendData(res, data);
};
