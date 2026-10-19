import { Router } from 'express';
import { authenticatedUser } from '../../auth/auth.service.js';
import { noStore, sendData } from '../../../shared/http/response.js';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import {
  publicId,
  paginationSchema,
  emptyBodySchema,
} from '../../../shared/validation/common.schema.js';
import { OrganizerBlockService } from './organizer-block.service.js';
export function createOrganizerBlockRouter() {
  const router = Router(),
    service = new OrganizerBlockService();
  router.use('/users/me/blocked-organizers', noStore, (req, _res, next) => {
    if (req.method !== 'GET') requireAppOrigin(req);
    next();
  });
  router.get('/users/me/blocked-organizers', async (req, res) => {
    const q = paginationSchema.parse(req.query);
    sendData(
      res,
      await service.list(await authenticatedUser(req.get('authorization')), q.page, q.pageSize),
    );
  });
  router.put('/users/me/blocked-organizers/:id', async (req, res) => {
    emptyBodySchema.parse(req.body);
    sendData(
      res,
      await service.change(
        await authenticatedUser(req.get('authorization')),
        publicId.parse(req.params.id),
        true,
      ),
    );
  });
  router.delete('/users/me/blocked-organizers/:id', async (req, res) => {
    if (req.body !== undefined) emptyBodySchema.parse(req.body);
    await service.change(
      await authenticatedUser(req.get('authorization')),
      publicId.parse(req.params.id),
      false,
    );
    res.status(204).end();
  });
  return router;
}
