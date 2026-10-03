import { Router } from 'express';
import { z } from 'zod';
import type { CatalogRepository } from './catalog.repository.js';
import { createCatalogService } from './catalog.service.js';

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9-]+$/);
const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');
const eventQuery = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(160).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  featured: booleanQuery.optional(),
  spotlight: booleanQuery.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export function createCatalogRouter(repository: CatalogRepository) {
  const router = Router();
  const service = createCatalogService(repository);
  const send = (res: Parameters<Parameters<typeof router.get>[1]>[1], data: unknown) =>
    res.json({ data, meta: { requestId: res.locals.requestId } });

  router.get('/catalog/home', async (_req, res) => send(res, await service.home()));
  router.get('/event-categories', async (_req, res) => send(res, await service.listCategories()));
  router.get('/events', async (req, res) =>
    send(res, await service.listEvents(eventQuery.parse(req.query))),
  );
  router.get('/events/:id', async (req, res) =>
    send(res, await service.event(idSchema.parse(req.params.id))),
  );
  router.get('/organizers', async (req, res) =>
    send(res, await service.listOrganizers(req.query.featured === 'true')),
  );
  router.get('/organizers/:id', async (req, res) =>
    send(res, await service.organizer(idSchema.parse(req.params.id))),
  );
  router.get('/merchandise', async (_req, res) => send(res, await service.listMerchandise()));
  router.get('/merchandise/:id', async (req, res) =>
    send(res, await service.merchandise(idSchema.parse(req.params.id))),
  );
  router.get('/articles', async (_req, res) => send(res, await service.listArticles()));
  router.get('/articles/:id', async (req, res) =>
    send(res, await service.article(idSchema.parse(req.params.id))),
  );
  router.get('/event-change-requests', async (_req, res) =>
    send(res, await service.listChangeRequests()),
  );
  router.get('/locations', async (_req, res) => send(res, await service.listLocations()));
  router.get('/venues', async (req, res) => {
    const city = z.string().trim().min(1).max(120).optional().parse(req.query.city);
    return send(res, await service.listVenues(city));
  });
  router.get('/venues/:id', async (req, res) =>
    send(res, await service.venue(z.string().regex(/^\d+$/).parse(req.params.id))),
  );
  return router;
}
