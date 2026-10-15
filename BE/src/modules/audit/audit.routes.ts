import { Router } from 'express';
import { authenticatedUser } from '../auth/auth.service.js';
import { noStore, sendData } from '../../shared/http/response.js';
import { AuditService } from './audit.service.js';
import { auditQuery } from './audit.schema.js';
export function createAuditRouter() {
  const router = Router(),
    service = new AuditService();
  router.get('/admin/audit-logs', noStore, async (req, res) =>
    sendData(
      res,
      await service.list(
        await authenticatedUser(req.get('authorization')),
        auditQuery.parse(req.query),
      ),
    ),
  );
  return router;
}
