import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withConnection } from '../../../shared/database/pool.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { usersRepository } from '../repositories/users.repository.js';
import type { ProfileUpdate } from '../schemas/users.schema.js';

export function getProfile(actor: RequestActor) {
  return withConnection((db) => usersRepository.profile(db, actor));
}
export function updateProfile(actor: RequestActor, input: ProfileUpdate, requestId: string) {
  return withTransaction(async (db) => {
    const existing = await usersRepository.profile(db, actor, true);
    await usersRepository.requireUpdatePermission(db, actor.id);
    if (input.gender === null || input.dateOfBirth === null)
      throw new AppError(
        422,
        'PROFILE_FIELDS_REQUIRED',
        'Giới tính và ngày sinh không được bỏ trống.',
      );
    if (input.dateOfBirth && input.dateOfBirth > (await usersRepository.today(db)))
      throw new AppError(400, 'INVALID_DATE_OF_BIRTH', 'Ngày sinh không được ở tương lai.');
    if (
      (input.displayName === undefined || input.displayName === existing.displayName) &&
      (input.gender === undefined || input.gender === existing.gender) &&
      (input.dateOfBirth === undefined || input.dateOfBirth === existing.dateOfBirth)
    )
      return existing;
    const result = await usersRepository.updateFields(db, actor.id, input);
    await usersRepository.auditUpdate(db, actor.id, requestId);
    return result;
  });
}
