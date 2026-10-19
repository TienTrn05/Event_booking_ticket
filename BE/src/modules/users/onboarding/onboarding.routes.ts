import { Router } from 'express';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { noStore } from '../../../shared/http/response.js';
import { OnboardingController } from './onboarding.controller.js';
import { QuestionnaireController } from './questions/questionnaire.controller.js';
export function createOnboardingRouter() {
  const router = Router(),
    controller = new OnboardingController();
  router.use('/users/me', noStore, (req, _res, next) => {
    if (req.method !== 'GET') requireAppOrigin(req);
    next();
  });
  router.get('/users/me/onboarding', controller.state);
  router.get('/users/me/onboarding/options', controller.options);
  router.put('/users/me/onboarding', controller.complete);
  router.put('/users/me/preferences', controller.preferences);
  router.post('/users/me/roles/customer', controller.customer);
  router.put('/users/me/onboarding/answers', controller.answers);
  const questions = new QuestionnaireController();
  router.get('/admin/onboarding/questions', noStore, questions.get);
  router.put(
    '/admin/onboarding/questions',
    noStore,
    (req, _res, next) => {
      requireAppOrigin(req);
      next();
    },
    questions.publish,
  );
  return router;
}
