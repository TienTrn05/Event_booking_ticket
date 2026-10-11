import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { usersRepository } from '../../users/repositories/users.repository.js';
import { checkMinimumAge } from './age.js';
import { ageRepository } from './age.repository.js';
import type { AgeRestrictionInput } from './age.schema.js';

export function updateAgeRestriction(
  actor: RequestActor,
  id: string,
  input: AgeRestrictionInput,
  requestId: string,
) {
  return withTransaction(async (db) => {
    await usersRepository.profile(db, actor, true);
    await ageRepository.draft(db, actor, id, input.version);
    const result = await ageRepository.update(db, id, input.minimumAge);
    await ageRepository.audit(db, actor.id, id, requestId);
    return result;
  });
}

export function ageEligibility(
  actor: RequestActor,
  eventId: string,
  sessionId: string,
  dateOfBirth?: string,
) {
  return withTransaction(async (db) => {
    const profile = await usersRepository.profile(db, actor);
    const event = await ageRepository.eligibilityContext(db, eventId, sessionId);
    if (!event) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy suất diễn.');
    const birth = dateOfBirth ?? profile.dateOfBirth;
    if (!birth)
      throw new AppError(422, 'DATE_OF_BIRTH_REQUIRED', 'Cần ngày sinh của người tham dự.');
    if (birth > event.today)
      throw new AppError(400, 'INVALID_DATE_OF_BIRTH', 'Ngày sinh không được ở tương lai.');
    return {
      ...checkMinimumAge(birth, event.reference_date, event.minimum_age),
      referenceDate: event.reference_date,
      identityVerified: false,
    };
  });
}
