import type { Express } from 'express';

import {
  createCatalogRouter,
} from './catalog/catalog.routes.js';

import type {
  CatalogRepository,
} from './catalog/catalog.repository.js';

export interface ModuleDependencies {
  catalogRepository?: CatalogRepository;
}

export function registerModules(
  app: Express,
  deps: ModuleDependencies,
) {
  if (deps.catalogRepository) {
    app.use(
      '/api/v1',
      createCatalogRouter(
        deps.catalogRepository,
      ),
    );
  }
}