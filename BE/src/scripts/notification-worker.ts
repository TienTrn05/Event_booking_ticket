import { dispatchOneNotification } from '../modules/notifications/services/notifications.service.js';
import { purgeExpiredCccd } from '../modules/tickets/attendees/attendee.service.js';
import { runWorker } from '../shared/workers/run-worker.js';

await runWorker(
  [
    {
      run: async () => {
        await purgeExpiredCccd();
        return false;
      },
      failureCode: 'ATTENDEE_RETENTION_FAILED',
      failureMessage: 'Attendee retention will retry.',
    },
    {
      run: dispatchOneNotification,
      failureCode: 'NOTIFICATION_DISPATCH_FAILED',
      failureMessage: 'Notification dispatch failed; pending message retained.',
    },
  ],
  3000,
);
