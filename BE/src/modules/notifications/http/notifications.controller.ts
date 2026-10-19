import type { RequestHandler } from 'express';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { sendData } from '../../../shared/http/response.js';
import { numericId, paginationSchema, publicId } from '../../../shared/validation/common.schema.js';
import { authenticatedUser } from '../../auth/auth.service.js';
import { followPreferenceSchema, followSchema } from '../schemas/notifications.schema.js';
import {
  followAction,
  inbox,
  listFollowing,
  readNotification,
} from '../services/notifications.service.js';

export function createNotificationsController() {
  const listFollowingHandler: RequestHandler = async (req, res) => {
    const actor = await authenticatedUser(req.get('authorization'));
    const page = paginationSchema.parse(req.query);
    const data = await listFollowing(actor, page);
    res.json({
      data: data.items,
      meta: {
        requestId: res.locals.requestId,
        pagination: {
          ...page,
          total: data.total,
          totalPages: Math.ceil(data.total / page.pageSize),
        },
      },
    });
  };

  const getFollowHandler: RequestHandler = async (req, res) => {
    const data = await followAction(
      await authenticatedUser(req.get('authorization')),
      publicId.parse(req.params.id),
      'get',
    );
    sendData(res, data);
  };

  const followHandler: RequestHandler = async (req, res) => {
    requireAppOrigin(req);
    const input = followSchema.parse(req.body ?? {});
    const data = await followAction(
      await authenticatedUser(req.get('authorization')),
      publicId.parse(req.params.id),
      'follow',
      input.notificationsEnabled,
    );
    sendData(res, data);
  };

  const setPreferenceHandler: RequestHandler = async (req, res) => {
    requireAppOrigin(req);
    const input = followPreferenceSchema.parse(req.body);
    const data = await followAction(
      await authenticatedUser(req.get('authorization')),
      publicId.parse(req.params.id),
      'preference',
      input.notificationsEnabled,
    );
    sendData(res, data);
  };

  const unfollowHandler: RequestHandler = async (req, res) => {
    requireAppOrigin(req);
    await followAction(
      await authenticatedUser(req.get('authorization')),
      publicId.parse(req.params.id),
      'unfollow',
    );
    res.sendStatus(204);
  };

  const inboxHandler: RequestHandler = async (req, res) => {
    const page = paginationSchema.parse(req.query);
    const data = await inbox(await authenticatedUser(req.get('authorization')), page);
    res.json({
      data: { items: data.items, unreadCount: data.unreadCount },
      meta: {
        requestId: res.locals.requestId,
        pagination: {
          ...page,
          total: data.total,
          totalPages: Math.ceil(data.total / page.pageSize),
        },
      },
    });
  };

  const readNotificationHandler: RequestHandler = async (req, res) => {
    requireAppOrigin(req);
    await readNotification(
      await authenticatedUser(req.get('authorization')),
      numericId.parse(req.params.id),
    );
    res.sendStatus(204);
  };
  return {
    listFollowing: listFollowingHandler,
    getFollow: getFollowHandler,
    follow: followHandler,
    setPreference: setPreferenceHandler,
    unfollow: unfollowHandler,
    inbox: inboxHandler,
    readNotification: readNotificationHandler,
  };
}
