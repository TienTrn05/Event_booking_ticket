import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { compareIds } from '../../../shared/database/ids.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import * as allocationRepo from '../allocation/allocation.repository.js';
import { allocationLocks, clearSeats } from '../allocation/allocation.service.js';
import { assertSale } from '../shared/booking.policy.js';
import * as repo from '../shared/booking.repository.js';
import { claimKey, finishKey } from '../../../shared/idempotency/idempotency.repository.js';
import * as bookingWrites from './booking-write.repository.js';
import type { BookingInput } from './booking.schema.js';
export async function createBooking(
  actor: RequestActor,
  input: BookingInput,
  key: string,
  requestId: string,
) {
  const normalized = {
    ...input,
    attendees: [...input.attendees].sort((a, b) => compareIds(a.sessionSeatId, b.sessionSeatId)),
  };
  return withTransaction(async (db) => {
    await repo.requireBuyer(db, actor, 'booking.create');
    const record = await claimKey(db, actor.id, 'booking.create', key, {
      method: 'POST',
      route: 'bookings',
      ...normalized,
    });
    if (record.resource_id)
      return {
        status: record.response_code!,
        data: await repo.bookingDto(db, record.resource_id, actor.id),
        replayed: true,
      };
    const first = await repo.holdRow(db, input.holdId, actor.id);
    const locked = await allocationLocks(db, first);
    if (locked.hold.status === 'CONVERTED' && locked.booking) {
      const existing = await bookingWrites.bookingAttendees(db, locked.booking.id);
      if (JSON.stringify(existing.rows) !== JSON.stringify(normalized.attendees))
        throw new AppError(
          409,
          'HOLD_ALREADY_CONVERTED',
          'Lượt giữ ghế đã tạo đơn với dữ liệu khác.',
        );
      await finishKey(db, record.id, 'BOOKING', locked.booking.id, 200);
      return {
        status: 200,
        data: await repo.bookingDto(db, locked.booking.id, actor.id),
        replayed: true,
      };
    }
    const time = await repo.now(db);
    assertSale(locked.context, time);
    if (locked.hold.status !== 'ACTIVE' || locked.hold.expires_at <= time)
      throw new AppError(409, 'HOLD_EXPIRED', 'Lượt giữ ghế không còn hiệu lực.');
    if (
      locked.items.length !== normalized.attendees.length ||
      locked.items.some(
        (item, i) => item.session_seat_id !== normalized.attendees[i]?.sessionSeatId,
      )
    )
      throw new AppError(
        400,
        'ATTENDEE_SET_MISMATCH',
        'Phải cung cấp tên riêng cho đúng toàn bộ ghế đang giữ.',
      );
    if (
      locked.seats.some(
        (s) =>
          s.status !== 'HELD' ||
          s.hold_id !== input.holdId ||
          s.current_booking_id !== null ||
          !s.hold_expires_at ||
          s.hold_expires_at <= time,
      )
    )
      throw new AppError(409, 'SEAT_UNAVAILABLE', 'Đơn không còn sở hữu đầy đủ ghế.');
    const total = locked.items.reduce((sum, i) => sum + BigInt(i.price_minor), 0n);
    if (total > 9223372036854775807n)
      throw new AppError(409, 'TOTAL_OVERFLOW', 'Tổng giá vượt giới hạn lưu trữ.');
    const booking = (
      await bookingWrites.insertBooking(db, {
        userId: actor.id,
        sessionId: first.session_id,
        eventId: locked.context.event_id,
        holdId: input.holdId,
        totalMinor: total.toString(),
        currency: locked.items[0]!.currency,
        expiresAt: locked.hold.expires_at,
      })
    ).rows[0]!;
    for (const [i, seat] of locked.seats.entries()) {
      const item = locked.items[i]!;
      await bookingWrites.insertBookingItem(db, {
        bookingId: booking.id,
        seatId: seat.id,
        sessionId: first.session_id,
        priceMinor: item.price_minor,
        currency: item.currency,
        attendeeName: normalized.attendees[i]!.attendeeName,
        ticketTypeCode: seat.ticket_type_code,
        ticketTypeName: seat.ticket_type_name,
        seatLabel: seat.seat_label,
      });
      await bookingWrites.assignSeatToBooking(db, seat.id, booking.id);
    }
    await allocationRepo.convertHold(db, input.holdId);
    await repo.audit(db, actor.id, 'booking.create', 'BOOKING', booking.id, requestId);
    await finishKey(db, record.id, 'BOOKING', booking.id, 201);
    return { status: 201, data: await repo.bookingDto(db, booking.id, actor.id), replayed: false };
  });
}

export async function cancelBooking(
  actor: RequestActor,
  id: string,
  reason: string,
  key: string,
  requestId: string,
) {
  return withTransaction(async (db) => {
    await repo.requireBuyer(db, actor, 'booking.create');
    const record = await claimKey(db, actor.id, 'booking.cancel', key, {
      method: 'POST',
      route: 'bookings/:bookingId/cancel',
      id,
      reason,
    });
    if (record.resource_id) return repo.bookingDto(db, id, actor.id);
    const first = await repo.bookingDto(db, id, actor.id);
    const locked = await allocationLocks(
      db,
      await repo.holdRow(db, String(first.holdId), actor.id),
    );
    if (!locked.booking || locked.booking.id !== id)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn.');
    if (!['AWAITING_PAYMENT', 'EXPIRED', 'CANCELLED'].includes(locked.booking.status))
      throw new AppError(
        409,
        'BOOKING_CANNOT_CANCEL',
        'Không thể hủy đơn đã xác nhận; cần quy trình hoàn tiền.',
      );
    if (locked.booking.status === 'AWAITING_PAYMENT') {
      const expired = locked.booking.expires_at <= (await repo.now(db));
      await clearSeats(db, locked.hold.id);
      await bookingWrites.setBookingStatus(db, id, expired ? 'EXPIRED' : 'CANCELLED');
      await repo.audit(db, actor.id, 'booking.cancel', 'BOOKING', id, requestId);
    }
    await finishKey(db, record.id, 'BOOKING', id, 200);
    return repo.bookingDto(db, id, actor.id);
  });
}
