import type { RequestActor } from '../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { OrganizerSalesReader } from './sales.ports.js';
import { SalesRepository } from './sales.repository.js';
import type {
  OrderFilter,
  TicketFilter,
  SalesFilter,
  ReconciliationFilter,
} from './sales.schema.js';
export class SalesService {
  constructor(
    private readonly repository: OrganizerSalesReader = new SalesRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  async orders(actor: RequestActor, orgId: string, q: OrderFilter) {
    return withTransaction(async (db) => {
      await this.access.organizer(db, actor, orgId, 'sales.read_own');
      return this.repository.orders(db, orgId, q);
    });
  }
  async order(actor: RequestActor, id: string) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'sales.read_own');
      const orgId = await this.repository.locate(db, id);
      if (!orgId) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn.');
      await this.access.organizer(db, actor, orgId, 'sales.read_own');
      const row = await this.repository.order(db, orgId, id);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn.');
      return row;
    });
  }
  async tickets(actor: RequestActor, orgId: string, q: TicketFilter) {
    return withTransaction(async (db) => {
      await this.access.organizer(db, actor, orgId, 'sales.read_own');
      return this.repository.tickets(db, orgId, q);
    });
  }
  async overview(actor: RequestActor, orgId: string, q: SalesFilter) {
    return withTransaction(async (db) => {
      await this.access.organizer(db, actor, orgId, 'sales.read_own');
      return {
        basis: 'BOOKING_CREATED_COHORT',
        range: { from: q.from ?? null, to: q.to ?? null },
        ...(await this.repository.overview(db, orgId, q)),
      };
    });
  }
  async reconciliation(actor: RequestActor, orgId: string, q: ReconciliationFilter) {
    return withTransaction(async (db) => {
      await this.access.organizer(db, actor, orgId, 'sales.read_own');
      return this.repository.reconciliation(db, orgId, q);
    });
  }
}
