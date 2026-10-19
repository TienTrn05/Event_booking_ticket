import { Router } from 'express';
import { noStore } from '../../../shared/http/response.js';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { MembershipController } from './membership.controller.js';
export function createMembershipRouter() {
  const router = Router(),
    controller = new MembershipController();
  router.use(
    [
      '/organizer/organizations/:organizationId/members',
      '/organizer/membership-invitations',
      '/organizer/memberships',
    ],
    noStore,
    (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      next();
    },
  );
  router.get('/organizer/organizations/:organizationId/members', controller.list);
  router.get('/organizer/membership-invitations', controller.invitations);
  router.post('/organizer/organizations/:organizationId/members', controller.invite);
  for (const action of ['accept', 'decline', 'revoke'] as const)
    router.post('/organizer/memberships/:id/' + action, controller.change(action));
  return router;
}
