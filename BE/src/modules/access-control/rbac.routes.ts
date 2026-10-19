import { Router } from 'express';
import { noStore } from '../../shared/http/response.js';
import { requireAppOrigin } from '../../shared/http/private-request.js';
import { RbacController } from './rbac.controller.js';
export function createRbacRouter() {
  const router = Router(),
    c = new RbacController();
  router.use('/admin/rbac', noStore, (req, _res, next) => {
    if (req.method !== 'GET') requireAppOrigin(req);
    next();
  });
  router.get('/admin/rbac/roles', c.roles);
  router.get('/admin/rbac/permissions', c.permissions);
  router.get('/admin/rbac/users', c.users);
  router.get('/admin/rbac/users/:userId', c.user);
  router.get('/admin/rbac/audit', c.audits);
  router.post('/admin/rbac/roles', c.create);
  router.put('/admin/rbac/roles/:roleId', c.update);
  router.post('/admin/rbac/roles/:roleId/archive', c.archive);
  router.put('/admin/rbac/users/:userId/roles/:roleId', c.grant);
  router.delete('/admin/rbac/users/:userId/roles/:roleId', c.revoke);
  return router;
}
