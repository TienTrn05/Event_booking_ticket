import type { PoolClient } from 'pg';
import type {
  OrderFilter,
  TicketFilter,
  SalesFilter,
  ReconciliationFilter,
} from './sales.schema.js';
export type OrderRow = {
  id: string;
  eventId: string;
  sessionId: string;
  eventTitle: string;
  customerName: string;
  status: string;
  totalMinor: string;
  currency: string;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
  ticketCount: number;
  refundStatus: string | null;
};
export type TicketRow = {
  id: string;
  bookingId: string;
  eventId: string;
  sessionId: string;
  eventTitle: string;
  status: string;
  attendeeName: string;
  seatLabel: string;
  ticketTypeName: string;
  createdAt: Date | string;
  admittedAt: Date | string | null;
};
export type SalesMoney = {
  currency: string;
  grossTicketSalesMinor: string;
  receivedMinor: string;
  refundedMinor: string;
  requestedRefundMinor: string;
  processingRefundMinor: string;
  failedRefundMinor: string;
  netReceivedMinor: string;
  reconciliationReceivedMinor: string;
  reconciliationPaymentCount: number;
};
export type ReconciliationRow = {
  id: string;
  bookingId: string;
  eventId: string;
  sessionId: string;
  status: string;
  amountMinor: string;
  receivedMinor: string;
  currency: string;
  reconciliationStatus: string;
  reconciliationReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};
export interface OrganizerSalesReader {
  locate(db: PoolClient, id: string): Promise<string | undefined>;
  orders(
    db: PoolClient,
    organizationId: string,
    q: OrderFilter,
  ): Promise<{ items: OrderRow[]; total: number }>;
  order(
    db: PoolClient,
    organizationId: string,
    id: string,
  ): Promise<
    | {
        order: OrderRow;
        items: {
          id: string;
          seatLabel: string;
          attendeeName: string;
          priceMinor: string;
          currency: string;
          ticketTypeName: string;
        }[];
        payments: ReconciliationRow[];
      }
    | undefined
  >;
  tickets(
    db: PoolClient,
    organizationId: string,
    q: TicketFilter,
  ): Promise<{ items: TicketRow[]; total: number }>;
  overview(
    db: PoolClient,
    organizationId: string,
    q: SalesFilter,
  ): Promise<{
    orders: Record<string, number>;
    tickets: Record<string, number>;
    money: SalesMoney[];
  }>;
  reconciliation(
    db: PoolClient,
    organizationId: string,
    q: ReconciliationFilter,
  ): Promise<{ items: ReconciliationRow[]; total: number }>;
}
