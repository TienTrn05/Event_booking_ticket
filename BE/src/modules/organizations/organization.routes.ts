import { Router } from 'express';
import { requireAppOrigin } from '../../shared/http/private-request.js';
import { noStore } from '../../shared/http/response.js';
import { OrganizationController } from './http/organization.controller.js';
export function createOrganizationRouter() {
  const router = Router(),
    controller = new OrganizationController();
  router.use(
    ['/organizations/applications', '/organizer/organizations', '/admin/organization-applications'],
    noStore,
    (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      next();
    },
  );
  router.get('/organizer/organizations', controller.memberships);
  router.post('/organizations/applications', controller.apply);
  router.get('/organizations/applications', controller.own);
  router.get('/organizations/applications/:id', controller.get);
  router.patch('/organizations/applications/:id', controller.resubmit);
  router.get('/admin/organization-applications', controller.list);
  router.post('/admin/organization-applications/:id/approve', controller.decide(true));
  router.post('/admin/organization-applications/:id/reject', controller.decide(false));
  return router;
}
