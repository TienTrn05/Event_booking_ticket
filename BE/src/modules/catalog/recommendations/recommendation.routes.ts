import { Router } from 'express';
import { z } from 'zod';
import { authenticatedUser } from '../../auth/auth.service.js';
import { noStore, sendData } from '../../../shared/http/response.js';
import { queryInteger } from '../../../shared/validation/common.schema.js';
import { RecommendationService } from './recommendation.service.js';
export function createRecommendationRouter() {
  const router = Router(),
    service = new RecommendationService();
  router.get('/users/me/recommendations', noStore, async (req, res) => {
    const q = z
      .object({ limit: queryInteger(40).default(12) })
      .strict()
      .parse(req.query);
    sendData(res, await service.list(await authenticatedUser(req.get('authorization')), q.limit));
  });
  return router;
}
