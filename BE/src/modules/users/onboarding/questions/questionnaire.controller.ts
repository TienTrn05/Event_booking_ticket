import type { RequestHandler } from 'express';
import { authenticatedUser } from '../../../auth/auth.service.js';
import { sendData } from '../../../../shared/http/response.js';
import { idempotencyKey } from '../../../../shared/idempotency/idempotency.schema.js';
import { publishQuestionsInput } from './questionnaire.schema.js';
import { QuestionnaireService } from './questionnaire.service.js';
export class QuestionnaireController {
  constructor(private readonly service = new QuestionnaireService()) {}
  get: RequestHandler = async (req, res) =>
    sendData(res, await this.service.get(await authenticatedUser(req.get('authorization'))));
  publish: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.publish(
        await authenticatedUser(req.get('authorization')),
        publishQuestionsInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
}
