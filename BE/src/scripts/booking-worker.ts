import { MerchandiseService } from '../modules/merchandise/merchandise.service.js';
import { expireBatch } from '../modules/bookings/allocation/allocation.service.js';
import { runWorker } from '../shared/workers/run-worker.js';
import { createCommerceServices } from '../startup/payment.dependencies.js';
import { EventManagementService } from '../modules/events/management/event-management.service.js';
import { EventOperationsService } from '../modules/events/operations/event-operations.service.js';
const commerce = createCommerceServices();

await runWorker(
  [
    {
      run: () => new MerchandiseService().expire(),
      failureCode: 'MERCHANDISE_EXPIRY_FAILED',
      failureMessage: 'Merchandise expiry will retry.',
    },
    {
      run: () => new EventOperationsService().recover(),
      failureCode: 'EVENT_OPERATIONS_FAILED',
      failureMessage: 'Event operation cleanup will retry.',
    },
    {
      run: () => new EventManagementService().expire(),
      failureCode: 'REVIEW_EXPIRY_FAILED',
      failureMessage: 'Review expiry will retry.',
    },
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
  'bookings',
);
