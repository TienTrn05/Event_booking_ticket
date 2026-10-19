import { privateOperation as op } from '../../../shared/openapi/private-operation.js';
import { invitationInput, membershipDecision } from './membership.schema.js';
export const membershipPaths = {
  '/organizer/organizations/{organizationId}/members': {
    get: op(
      '/organizer/organizations/{organizationId}/members',
      'get',
      'Organizer',
      'Chủ hồ sơ xem membership của tổ chức APPROVED.',
      undefined,
      ['page', 'pageSize'],
    ),
    post: op(
      '/organizer/organizations/{organizationId}/members',
      'post',
      'Organizer',
      'Chủ hồ sơ mời User ORGANIZER; version=0 khi chưa có hoặc version của REVOKED. INVITED chưa cấp quyền.',
      invitationInput,
    ),
  },
  '/organizer/membership-invitations': {
    get: op(
      '/organizer/membership-invitations',
      'get',
      'Organizer',
      'Lời mời INVITED của chính User.',
      undefined,
      ['page', 'pageSize'],
    ),
  },
  ...Object.fromEntries(
    (['accept', 'decline', 'revoke'] as const).map((action) => [
      '/organizer/memberships/{id}/' + action,
      {
        post: op(
          '/organizer/memberships/{id}/' + action,
          'post',
          'Organizer',
          action === 'revoke'
            ? 'Chủ hồ sơ thu hồi membership, không thu hồi chủ tổ chức.'
            : 'Người nhận ' + action + ' lời mời; không đổi role/User.',
          membershipDecision,
        ),
      },
    ]),
  ),
};
