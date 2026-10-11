import { expireBatch } from '../modules/bookings/allocation/allocation.service.js';
import { runWorker } from '../shared/workers/run-worker.js';
import { createCommerceServices } from '../startup/payment.dependencies.js';
const commerce = createCommerceServices();

await runWorker(
  [
    {
      run: async () => (await expireBatch()) === 100,
      failureCode: 'BOOKING_EXPIRY_FAILED',
      failureMessage: 'Booking expiry will retry.',
    },
    {
      run: () => commerce.payments.recover(),
      failureCode: 'PAYMENT_RECOVERY_FAILED',
      failureMessage: 'Payment recovery will retry.',
    },
  ],
  1000,
);
