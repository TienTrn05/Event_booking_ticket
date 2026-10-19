import {
  body,
  common,
  errors,
  page,
  pathId,
  result,
} from '../../../shared/openapi/feature-helpers.js';

const follow = {
  type: 'object',
  properties: { following: { type: 'boolean' }, notificationsEnabled: { type: 'boolean' } },
};
const preference = {
  type: 'object',
  additionalProperties: false,
  properties: { notificationsEnabled: { type: 'boolean' } },
};

const queryRead = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'object' } },
    unreadCount: { type: 'integer' },
  },
};
export const featurePaths = {
  '/users/me/following': {
    get: {
      ...common,
      tags: ['Notifications'],
      operationId: 'listFollowing',
      summary: 'Danh sách Organizer Customer đang theo dõi',
      parameters: page,
      responses: { ...errors, '200': result({ type: 'array', items: { type: 'object' } }) },
    },
  },
  '/organizers/{id}/follow': {
    get: {
      ...common,
      tags: ['Notifications'],
      operationId: 'getFollowState',
      summary: 'Trạng thái theo dõi của chính User',
      parameters: [pathId()],
      responses: { ...errors, '200': result(follow) },
    },
    put: {
      ...common,
      tags: ['Notifications'],
      operationId: 'followOrganizer',
      summary: 'Theo dõi Organizer APPROVED (public ID)',
      parameters: [pathId()],
      requestBody: body(preference),
      description:
        'Customer, Origin + Bearer. Lần đầu mặc định bật notification; PUT lặp không truyền preference giữ tùy chọn cũ. Không tự cấp quyền Organizer.',
      responses: { ...errors, '200': result(follow) },
    },
    patch: {
      ...common,
      tags: ['Notifications'],
      operationId: 'setFollowNotifications',
      summary: 'Bật/tắt thông báo sự kiện mới cho một Organizer',
      parameters: [pathId()],
      requestBody: body({ ...preference, required: ['notificationsEnabled'] }),
      responses: { ...errors, '200': result(follow) },
    },
    delete: {
      ...common,
      tags: ['Notifications'],
      operationId: 'unfollowOrganizer',
      summary: 'Bỏ theo dõi, idempotent',
      parameters: [pathId()],
      responses: { ...errors, '204': { description: 'Đã bỏ theo dõi.' } },
    },
  },
  '/notifications': {
    get: {
      ...common,
      tags: ['Notifications'],
      operationId: 'listMyNotifications',
      summary: 'Inbox của chính User, kèm unreadCount',
      parameters: page,
      responses: { ...errors, '200': result(queryRead) },
    },
  },
  '/notifications/{id}/read': {
    post: {
      ...common,
      tags: ['Notifications'],
      operationId: 'readMyNotification',
      summary: 'Đánh dấu thông báo của chính User đã đọc',
      parameters: [pathId()],
      responses: { ...errors, '204': { description: 'Đã đọc, lặp không đổi readAt.' } },
    },
  },
};
