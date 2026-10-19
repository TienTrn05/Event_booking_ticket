import { Router } from 'express';
import { authenticatedUser } from '../auth/auth.service.js';
import { noStore, sendData } from '../../shared/http/response.js';
import { searchQuery } from './search.schema.js';
import { SearchService } from './search.service.js';
export function createSearchRouter(service = new SearchService()) {
  const router = Router();
  router.use('/search/events', noStore, (_req, res, next) => {
    res.vary('Authorization');
    next();
  });
  router.get('/search/events', async (req, res) =>
    sendData(
      res,
      await service.search(
        searchQuery.parse(req.query),
        req.get('authorization') ? await authenticatedUser(req.get('authorization')) : undefined,
      ),
    ),
  );
  router.get('/search/events/suggestions', async (req, res) => {
    const q = searchQuery.parse(req.query);
    const actor = req.get('authorization')
      ? await authenticatedUser(req.get('authorization'))
      : undefined;
    sendData(
      res,
      q.q && q.q.length >= 2
        ? await service.search({ ...q, page: 1, pageSize: 6, sort: 'relevance' }, actor, true)
        : { items: [] },
    );
  });
  return router;
}
