import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { checkMinimumAge } from '../../events/age/age.js';
import { followsRepository } from '../../notifications/repositories/follows.repository.js';
import { usersRepository } from '../../users/repositories/users.repository.js';
import { matchesCccd } from './attendee.crypto.js';
import { attendeeRepository } from './attendee.repository.js';
import type { AttendeeInput } from './attendee.schema.js';
export function getAttendees(actor: RequestActor, id: string) {
  return withTransaction(async (db) => {
    await usersRepository.profile(db, actor);
    await attendeeRepository.booking(db, actor, id);
    return attendeeRepository.list(db, id);
  });
}
export function saveAttendees(
  actor: RequestActor,
  id: string,
  attendees: AttendeeInput[],
  requestId: string,
) {
  return withTransaction(async (db) => {
    await usersRepository.profile(db, actor, true);
    await followsRepository.requireCustomer(db, actor.id);
    const context = await attendeeRepository.booking(db, actor, id, true);
    if (
      context.status !== 'AWAITING_PAYMENT' ||
      context.expired ||
      context.event_status !== 'PUBLISHED' ||
      context.session_status !== 'SCHEDULED'
    )
      throw new AppError(
        409,
        'BOOKING_NOT_EDITABLE',
        'Không thể sửa thông tin người tham dự của đơn này.',
      );
    const items = await attendeeRepository.items(db, id, true);
    if (await attendeeRepository.paymentInProgress(db, id))
      throw new AppError(
        409,
        'ATTENDEES_LOCKED',
        'Không thể đổi người tham dự khi thanh toán đang xử lý.',
      );
    const ids = new Set(items.map((i) => i.id));
    if (
      attendees.length !== items.length ||
      attendees.some((a) => !ids.has(a.bookingItemId)) ||
      new Set(attendees.map((a) => a.bookingItemId)).size !== items.length
    )
      throw new AppError(422, 'ATTENDEE_SET_MISMATCH', 'Mỗi vé phải có một bộ thông tin riêng.');
    for (const attendee of attendees) {
      if (attendee.dateOfBirth > context.today)
        throw new AppError(400, 'INVALID_DATE_OF_BIRTH', 'Ngày sinh không được ở tương lai.');
      if (
        !checkMinimumAge(attendee.dateOfBirth, context.reference_date, context.minimum_age).eligible
      )
        throw new AppError(
          422,
          'ATTENDEE_TOO_YOUNG',
          'Có người tham dự chưa đủ tuổi cho suất diễn.',
        );
      await attendeeRepository.save(db, context, attendee);
    }
    await attendeeRepository.audit(db, actor.id, id, 'booking.attendees.update', requestId);
    return attendeeRepository.list(db, id);
  });
}
export function verifyAttendee(
  actor: RequestActor,
  id: string,
  input: { cccd: string; fullName: string; dateOfBirth: string },
  requestId: string,
) {
  return withTransaction(async (db) => {
    await usersRepository.profile(db, actor, true);
    const attendee = await attendeeRepository.verification(db, actor, id);
    if (
      !attendee.cccd_mac ||
      !matchesCccd(input.cccd, attendee.session_id, attendee.cccd_mac) ||
      input.fullName !== attendee.full_name ||
      input.dateOfBirth !== attendee.date_of_birth
    )
      throw new AppError(
        422,
        'ATTENDEE_IDENTITY_MISMATCH',
        'Giấy tờ không khớp thông tin người tham dự.',
      );
    if (!checkMinimumAge(input.dateOfBirth, attendee.reference_date, attendee.minimum_age).eligible)
      throw new AppError(422, 'ATTENDEE_TOO_YOUNG', 'Người tham dự chưa đủ tuổi.');
    await attendeeRepository.markVerified(db, attendee.booking_item_id, actor.id);
    await attendeeRepository.audit(db, actor.id, id, 'ticket.attendee.verify', requestId);
    return { identityVerified: true };
  });
}
export function purgeExpiredCccd() {
  return withTransaction((db) => attendeeRepository.purge(db));
}
