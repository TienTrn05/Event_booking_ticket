import { dispatchOneNotification } from '../modules/notifications/services/notifications.service.js';
import { purgeExpiredCccd } from '../modules/tickets/attendees/attendee.service.js';
import { runWorker } from '../shared/workers/run-worker.js';
import { SearchIndexer } from '../modules/search/search.service.js';
const searchIndexer = new SearchIndexer();

await runWorker(
  [
    {
      run: () => searchIndexer.recover(),
      failureCode: 'SEARCH_INDEX_WRITE_FAILED',
      failureMessage: 'Search index update retained for retry.',
    },
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
  'notifications',
);
