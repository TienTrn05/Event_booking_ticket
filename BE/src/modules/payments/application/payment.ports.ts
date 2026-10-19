import type { PoolClient } from 'pg';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
export type PaymentRequest = {
  orderCode: number;
  amount: number;
  description: string;
  items: { name: string; quantity: number; price: number }[];
  expiredAt: number;
  returnUrl: string;
  cancelUrl: string;
};
export type PaymentLink = { orderCode: number; amount: number; id: string; checkoutUrl: string };
export type Receipt = {
  orderCode: string;
  amount: string;
  reference: string;
  paymentLinkId: string;
  currency: string;
  code: string;
};
export interface PaymentGateway {
  create(input: PaymentRequest): Promise<PaymentLink>;
  find(orderCode: number): Promise<PaymentLink>;
  status(
    orderCode: number,
  ): Promise<{ link: PaymentLink; status: string; receipts: Receipt[]; amountPaid: number }>;
  verify(payload: unknown): Promise<Receipt>;
}
export type PaymentPurchase = {
  id: string;
  customerId: string;
  status: string;
  confirmedPaymentId: string | null;
  expiresAt: Date;
  expired: boolean;
  amount: string;
  currency: string;
  canConfirm: boolean;
  items: { id: string; name: string; price: string; quantity?: number }[];
};
export type LockedPurchase = PaymentPurchase & {
  sessionId: string;
  holdId: string;
  items: { id: string; seatId: string; name: string; price: string }[];
};
export interface PurchaseReader {
  lock(db: PoolClient, bookingId: string, ownerId?: string): Promise<LockedPurchase>;
}
export interface PurchasePaymentPort {
  lock(db: PoolClient, id: string, ownerId?: string): Promise<PaymentPurchase>;
  authorize(
    db: PoolClient,
    actor: RequestActor,
    permission?: 'booking.create' | 'booking.read_self',
  ): Promise<void>;
  validateAttendees(db: PoolClient, purchase: PaymentPurchase): Promise<boolean>;
  confirm(db: PoolClient, purchase: PaymentPurchase, paymentId: string): Promise<void>;
  terminate(
    db: PoolClient,
    purchase: PaymentPurchase,
    status: 'EXPIRED' | 'CANCELLED',
  ): Promise<void>;
}
export interface BookingPaymentPort extends PurchasePaymentPort, PurchaseReader {
  lock(db: PoolClient, id: string, ownerId?: string): Promise<LockedPurchase>;
}
export interface TicketIssuer {
  issue(db: PoolClient, purchase: LockedPurchase): Promise<void>;
}
