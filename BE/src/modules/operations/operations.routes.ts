import { Router } from 'express';
import { noStore, sendData } from '../../shared/http/response.js';
import { authenticatedUser } from '../auth/auth.service.js';
import { OperationsService } from './operations.service.js';
export function createOperationsRouter() {
  const router = Router(),
    service = new OperationsService();
  router.get('/admin/operations/health', noStore, async (req, res) =>
    sendData(res, await service.health(await authenticatedUser(req.get('authorization')))),
  );
  return router;
}
