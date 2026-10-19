import type { RequestHandler } from 'express';
import { authenticatedUser } from '../../auth/auth.service.js';
import { sendData } from '../../../shared/http/response.js';
import { emptyBodySchema } from '../../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../../shared/idempotency/idempotency.schema.js';
import { onboardingInput, preferencesInput } from './onboarding.schema.js';
import { OnboardingService } from './onboarding.service.js';
import { editAnswersInput } from './questions/questionnaire.schema.js';
export class OnboardingController {
  constructor(private readonly service = new OnboardingService()) {}
  state: RequestHandler = async (req, res) =>
    sendData(res, await this.service.state(await authenticatedUser(req.get('authorization'))));
  options: RequestHandler = async (req, res) =>
    sendData(res, await this.service.options(await authenticatedUser(req.get('authorization'))));
  complete: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.complete(
        await authenticatedUser(req.get('authorization')),
        onboardingInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  preferences: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.preferences(
        await authenticatedUser(req.get('authorization')),
        preferencesInput.parse(req.body),
        String(res.locals.requestId),
      ),
    );
  answers: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.answers(
        await authenticatedUser(req.get('authorization')),
        editAnswersInput.parse(req.body).answers,
        String(res.locals.requestId),
      ),
    );
  customer: RequestHandler = async (req, res) => {
    emptyBodySchema.parse(req.body ?? {});
    sendData(
      res,
      await this.service.customer(
        await authenticatedUser(req.get('authorization')),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
}
