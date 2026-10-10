import { checkDatabase } from '../shared/database/pool.js';

import { logger } from '../shared/logging/logger.js';

import { postgresCatalogRepository } from '../modules/catalog/catalog.repository.js';

export const dependencies = {
  checkDatabase,

  catalogRepository: postgresCatalogRepository,

  logRequest: (fields: { requestId: string; method: string; statusCode: number }) => {
    logger.info(fields, 'request completed');
  },
};
