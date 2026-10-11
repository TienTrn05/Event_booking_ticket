import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { claimKey, finishKey } from '../../../shared/idempotency/idempotency.repository.js';
import { usersRepository } from '../../users/repositories/users.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { PurchaseReader } from '../../payments/application/payment.ports.js';
import { TicketRepository } from '../repositories/ticket.repository.js';
import { CheckInRepository, type EntryTicket } from '../check-in/check-in.repository.js';
import { ticketHash, revealCode } from '../issuance/ticket.crypto.js';
import { matchesCccd } from '../attendees/attendee.crypto.js';
import { checkMinimumAge } from '../../events/age/age.js';
import * as buyer from '../../bookings/shared/booking.repository.js';
export type CheckInInput = { attendeeName: string; ticketCode: string };
export type AdmissionInput = {
  ticketCode: string;
  cccd: string;
  fullName: string;
  dateOfBirth: string;
  physicalDocumentSeen: true;
};
export class TicketService {
  constructor(
    private readonly bookings: PurchaseReader,
    private readonly repository = new TicketRepository(),
    private readonly entry = new CheckInRepository(),
  ) {}
  async list(actor: RequestActor, bookingId?: string, ticketId?: string) {
    return withTransaction(async (db) => {
      await buyer.requireBuyer(db, actor, 'ticket.read_self');
      const rows = await this.repository.own(db, actor.id, bookingId, ticketId);
      if (ticketId && !rows.length) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy vé.');
      return rows.map((row) => ({
        id: row.id,
        bookingId: row.booking_id,
        sessionId: row.session_id,
        eventId: row.event_id,
        title: row.title,
        status: row.status,
        attendeeName: row.attendee_name,
        seatLabel: row.seat_label,
        startsAt: row.starts_at,
        timezone: row.timezone,
        checkInMethod: row.check_in_method,
        checkedInAt: row.checked_in_at,
        admittedAt: row.admitted_at,
        onlineCheckInOpen: row.online_check_in_open,
        ticketCode:
          row.status === 'VALID' &&
          row.event_status === 'PUBLISHED' &&
          row.session_status === 'SCHEDULED' &&
          row.organization_status === 'APPROVED'
            ? revealCode(
                row.ticket_code_ciphertext,
                row.item_id,
                row.session_id,
                row.ticket_key_version,
              )
            : null,
      }));
    });
  }
  async sessions(actor: RequestActor) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      const access = await this.entry.staff(db, actor);
      return this.entry.sessions(
        db,
        access.map((o) => o.organization_id),
      );
    });
  }
  async lookup(actor: RequestActor, sessionId: string, code: string) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      const located = await this.entry.locate(db, ticketHash(code));
      if (!located || located.session_id !== sessionId)
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy vé đúng suất.');
      await this.entry.staff(db, actor, located.organization_id);
      await this.bookings.lock(db, located.booking_id);
      const ticket = await this.entry.lock(db, located.id),
        checkIn = await this.entry.existing(db, ticket.id);
      return {
        ticketId: ticket.id,
        attendeeName: ticket.name,
        status: ticket.status,
        checkedIn: !!checkIn,
      };
    });
  }
  private valid(ticket: EntryTicket, purchaseStatus: string) {
    if (ticket.status !== 'VALID')
      throw new AppError(409, 'TICKET_NOT_VALID', 'Vé đã sử dụng hoặc không còn hiệu lực.');
    if (
      purchaseStatus !== 'CONFIRMED' ||
      ticket.event_status !== 'PUBLISHED' ||
      ticket.session_status !== 'SCHEDULED' ||
      ticket.organization_status !== 'APPROVED'
    )
      throw new AppError(409, 'TICKET_NOT_VALID', 'Sự kiện hoặc đơn không còn hiệu lực vào cửa.');
  }
  async checkIn(
    actor: RequestActor,
    target: string,
    input: CheckInInput,
    key: string,
    requestId: string,
    method: 'ONLINE' | 'COUNTER',
  ) {
    return withTransaction(async (db) => {
      if (method === 'ONLINE') await buyer.requireBuyer(db, actor, 'ticket.checkin_self');
      else await usersRepository.profile(db, actor, true);
      const located = await this.entry.locate(db, ticketHash(input.ticketCode));
      if (!located || (method === 'ONLINE' ? located.id !== target : located.session_id !== target))
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy vé đúng suất.');
      if (method === 'COUNTER') await this.entry.staff(db, actor, located.organization_id);
      const record = await claimKey(db, actor.id, 'ticket.checkin.' + method, key, {
        target,
        ...input,
      });
      const purchase = await this.bookings.lock(
        db,
        located.booking_id,
        method === 'ONLINE' ? actor.id : undefined,
      );
      const ticket = await this.entry.lock(db, located.id);
      if (record.resource_id) {
        const existing = await this.entry.existing(db, ticket.id);
        return { ticketId: ticket.id, status: ticket.status, checkIn: existing };
      }
      this.valid(ticket, purchase.status);
      if (input.attendeeName !== ticket.name)
        throw new AppError(422, 'ATTENDEE_NAME_MISMATCH', 'Tên người tham dự không khớp vé.');
      const opens =
        method === 'ONLINE'
          ? new Date(ticket.starts_at.getTime() - 86400000)
          : ticket.counter_opens_at;
      const closes = method === 'ONLINE' ? ticket.starts_at : ticket.counter_closes_at;
      if (ticket.now < opens || ticket.now >= closes)
        throw new AppError(
          409,
          'CHECK_IN_CLOSED',
          'Chưa đến hoặc đã hết thời gian xác nhận check-in.',
        );
      const existing = await this.entry.existing(db, ticket.id),
        checkIn = existing ?? (await this.entry.checkIn(db, ticket.id, actor.id, method));
      if (!existing)
        await this.repository.audit(db, actor.id, 'ticket.checkin', ticket.id, requestId);
      await finishKey(db, record.id, 'TICKET', ticket.id, 200);
      return { ticketId: ticket.id, status: ticket.status, checkIn };
    });
  }
  async admit(
    actor: RequestActor,
    sessionId: string,
    input: AdmissionInput,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      const located = await this.entry.locate(db, ticketHash(input.ticketCode));
      if (!located || located.session_id !== sessionId)
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy vé đúng suất.');
      await this.entry.staff(db, actor, located.organization_id);
      const record = await claimKey(db, actor.id, 'ticket.admit', key, { sessionId, ...input });
      const purchase = await this.bookings.lock(db, located.booking_id),
        ticket = await this.entry.lock(db, located.id);
      if (record.resource_id) return { ticketId: ticket.id, status: ticket.status };
      this.valid(ticket, purchase.status);
      if (ticket.now < ticket.admission_opens_at || ticket.now >= ticket.admission_closes_at)
        throw new AppError(409, 'ADMISSION_CLOSED', 'Chưa đến hoặc đã hết thời gian vào cửa.');
      if (
        !ticket.proof_available ||
        !ticket.cccd_mac ||
        !ticket.birth ||
        !matchesCccd(input.cccd, ticket.session_id, ticket.cccd_mac) ||
        input.fullName !== ticket.name ||
        input.dateOfBirth !== ticket.birth
      )
        throw new AppError(
          422,
          'ATTENDEE_IDENTITY_MISMATCH',
          'Giấy tờ không khớp thông tin người tham dự.',
        );
      if (!checkMinimumAge(ticket.birth, ticket.reference_date, ticket.minimum_age).eligible)
        throw new AppError(422, 'ATTENDEE_TOO_YOUNG', 'Người tham dự chưa đủ tuổi.');
      const checkIn = await this.entry.existing(db, ticket.id);
      if (!checkIn)
        throw new AppError(422, 'CHECK_IN_REQUIRED', 'Cần xác nhận check-in trước khi vào cửa.');
      await this.entry.admit(db, ticket, checkIn.id, actor.id);
      await this.repository.audit(db, actor.id, 'ticket.admit', ticket.id, requestId);
      await finishKey(db, record.id, 'TICKET', ticket.id, 200);
      return { ticketId: ticket.id, status: 'USED' };
    });
  }
}
