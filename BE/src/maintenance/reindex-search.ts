import { SearchIndexer } from '../modules/search/search.service.js';
import { pool } from '../shared/database/pool.js';
import { closeRedis } from '../shared/redis/client.js';
try {
  await new SearchIndexer().reindex();
  console.log('Search index synchronized from public PostgreSQL data.');
} finally {
  await pool.end();
  await closeRedis();
}
