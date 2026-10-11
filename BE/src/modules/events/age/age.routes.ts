import { Router } from 'express';
import { checkEligibility, updateRestriction } from './age.controller.js';

export function createAgeRouter() {
  const router = Router();
  router.patch('/events/:id/age-restriction', updateRestriction);
  router.post('/events/:id/sessions/:sessionId/age-eligibility', checkEligibility);
  return router;
}
