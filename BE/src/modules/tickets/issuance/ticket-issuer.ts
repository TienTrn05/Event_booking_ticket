import type { PoolClient } from 'pg';
import type { LockedPurchase, TicketIssuer } from '../../payments/application/payment.ports.js';
import { TicketRepository } from '../repositories/ticket.repository.js';
export class DatabaseTicketIssuer implements TicketIssuer {
  constructor(private readonly repository = new TicketRepository()) {}
  issue(db: PoolClient, purchase: LockedPurchase) {
    return this.repository.issue(db, purchase);
  }
}
