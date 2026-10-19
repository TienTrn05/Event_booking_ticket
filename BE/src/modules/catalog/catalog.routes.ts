import { Router } from 'express';
import type { CatalogRepository } from './catalog.repository.js';
import { createCatalogController } from './http/catalog.controller.js';

export function createCatalogRouter(repository: CatalogRepository) {
  const router = Router();
  const controller = createCatalogController(repository);

  router.get('/catalog/home', controller.home);
  router.get('/event-categories', controller.listCategories);
  router.get('/events', controller.listEvents);
  router.get('/events/:id', controller.event);
  router.get('/organizers', controller.listOrganizers);
  router.get('/organizers/:id', controller.organizer);
  router.get('/merchandise', controller.listMerchandise);
  router.get('/merchandise/:id', controller.merchandise);
  router.get('/articles', controller.listArticles);
  router.get('/articles/:id', controller.article);
  router.get('/event-change-requests', controller.listChangeRequests);
  router.get('/locations', controller.listLocations);
  router.get('/venues', controller.listVenues);
  router.get('/venues/:id', controller.venue);
  return router;
}
