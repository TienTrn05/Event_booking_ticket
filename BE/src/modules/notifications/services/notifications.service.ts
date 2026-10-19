import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { PageInput } from '../../../shared/validation/common.schema.js';
import { usersRepository } from '../../users/repositories/users.repository.js';
import { followsRepository } from '../repositories/follows.repository.js';
import { notificationsRepository } from '../repositories/notifications.repository.js';

export function followAction(
  actor: RequestActor,
  id: string,
  action: 'get' | 'follow' | 'preference' | 'unfollow',
  enabled?: boolean,
) {
  return withTransaction(async (db) => {
    await usersRepository.profile(db, actor, true);
    await usersRepository.requireOnboarding(db, actor.id);
    const customer = await usersRepository.hasCustomer(db, actor.id);
    if (enabled === true && !customer)
      throw new AppError(403, 'CUSTOMER_REQUIRED', 'Thông báo mở bán dành cho Customer.');
    const orgId = await followsRepository.organization(db, id, action !== 'unfollow');
    if (action === 'get') return followsRepository.get(db, actor.id, orgId);
    if (action === 'follow')
      return followsRepository.follow(db, actor.id, orgId, enabled ?? customer);
    if (action === 'preference') return followsRepository.preference(db, actor.id, orgId, enabled!);
    await followsRepository.unfollow(db, actor.id, orgId);
    return undefined;
  });
}
export function listFollowing(actor: RequestActor, page: PageInput) {
  return withTransaction(async (db) => {
    await usersRepository.profile(db, actor);
    await usersRepository.requireOnboarding(db, actor.id);
    return followsRepository.list(db, actor.id, page);
  });
}
export function inbox(actor: RequestActor, page: PageInput) {
  return withTransaction(async (db) => {
    await usersRepository.profile(db, actor);
    return notificationsRepository.inbox(db, actor.id, page);
  });
}
export function readNotification(actor: RequestActor, id: string) {
  return withTransaction(async (db) => {
    await usersRepository.profile(db, actor, true);
    await notificationsRepository.read(db, actor.id, id);
  });
}
export function dispatchOneNotification() {
  return withTransaction((db) => notificationsRepository.dispatch(db));
}
