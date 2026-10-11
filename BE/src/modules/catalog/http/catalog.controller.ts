import type { RequestHandler, Response } from 'express';
import { sendData } from '../../../shared/http/response.js';
import { numericId } from '../../../shared/validation/common.schema.js';
import type { CatalogRepository } from '../catalog.repository.js';
import { createCatalogService } from '../catalog.service.js';
import { catalogId, eventQuery, organizerQuery, venueQuery } from '../schemas/catalog.schema.js';

export function createCatalogController(repository: CatalogRepository) {
  const service = createCatalogService(repository);
  const send = (res: Response, data: unknown) => sendData(res, data);
  const homeHandler: RequestHandler = async (_req, res) => send(res, await service.home());

  const listCategoriesHandler: RequestHandler = async (_req, res) =>
    send(res, await service.listCategories());

  const listEventsHandler: RequestHandler = async (req, res) =>
    send(res, await service.listEvents(eventQuery.parse(req.query)));

  const eventHandler: RequestHandler = async (req, res) =>
    send(res, await service.event(catalogId.parse(req.params.id)));

  const listOrganizersHandler: RequestHandler = async (req, res) =>
    send(res, await service.listOrganizers(organizerQuery.parse(req.query).featured));

  const organizerHandler: RequestHandler = async (req, res) =>
    send(res, await service.organizer(catalogId.parse(req.params.id)));

  const listMerchandiseHandler: RequestHandler = async (_req, res) =>
    send(res, await service.listMerchandise());

  const merchandiseHandler: RequestHandler = async (req, res) =>
    send(res, await service.merchandise(catalogId.parse(req.params.id)));

  const listArticlesHandler: RequestHandler = async (_req, res) =>
    send(res, await service.listArticles());

  const articleHandler: RequestHandler = async (req, res) =>
    send(res, await service.article(catalogId.parse(req.params.id)));

  const listChangeRequestsHandler: RequestHandler = async (_req, res) =>
    send(res, await service.listChangeRequests());

  const listLocationsHandler: RequestHandler = async (_req, res) =>
    send(res, await service.listLocations());

  const listVenuesHandler: RequestHandler = async (req, res) => {
    const city = venueQuery.parse(req.query).city;
    return send(res, await service.listVenues(city));
  };

  const venueHandler: RequestHandler = async (req, res) =>
    send(res, await service.venue(numericId.parse(req.params.id)));
  return {
    home: homeHandler,
    listCategories: listCategoriesHandler,
    listEvents: listEventsHandler,
    event: eventHandler,
    listOrganizers: listOrganizersHandler,
    organizer: organizerHandler,
    listMerchandise: listMerchandiseHandler,
    merchandise: merchandiseHandler,
    listArticles: listArticlesHandler,
    article: articleHandler,
    listChangeRequests: listChangeRequestsHandler,
    listLocations: listLocationsHandler,
    listVenues: listVenuesHandler,
    venue: venueHandler,
  };
}
