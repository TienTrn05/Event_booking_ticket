import { PayOS } from '@payos/node';
import { env } from '../config/env.js';
import type {
  PaymentGateway,
  TicketIssuer,
} from '../modules/payments/application/payment.ports.js';
import { PayosGateway } from '../modules/payments/gateways/payos.gateway.js';
import { PaymentService } from '../modules/payments/application/payment.service.js';
import { BookingPaymentAdapter } from '../modules/bookings/payments/booking-payment.adapter.js';
import { DatabaseTicketIssuer } from '../modules/tickets/issuance/ticket-issuer.js';
import { TicketService } from '../modules/tickets/application/ticket.service.js';
export function createCommerceServices(gateway?: PaymentGateway, issuer?: TicketIssuer) {
  const bookingPort = new BookingPaymentAdapter();
  const provider =
    gateway ??
    (env.PAYOS_CLIENT_ID && env.PAYOS_API_KEY && env.PAYOS_CHECKSUM_KEY
      ? new PayosGateway(
          new PayOS({
            clientId: env.PAYOS_CLIENT_ID,
            apiKey: env.PAYOS_API_KEY,
            checksumKey: env.PAYOS_CHECKSUM_KEY,
            timeout: 5000,
            maxRetries: 0,
            logLevel: 'off',
          }),
        )
      : undefined);
  return {
    payments: new PaymentService(
      provider,
      bookingPort,
      issuer ?? new DatabaseTicketIssuer(),
      env.PUBLIC_APP_URL,
    ),
    tickets: new TicketService(bookingPort),
  };
}
