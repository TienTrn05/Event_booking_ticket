import type { Express } from 'express';

import { createCatalogRouter } from './catalog/catalog.routes.js';

import type { CatalogRepository } from './catalog/catalog.repository.js';
import { createAuthRouter } from './auth/auth.routes.js';

export interface ModuleDependencies {
  catalogRepository?: CatalogRepository;
}

export function registerModules(app: Express, deps: ModuleDependencies) {
  app.use('/api/v1/auth', createAuthRouter());
  if (deps.catalogRepository) {
    app.use('/api/v1', createCatalogRouter(deps.catalogRepository));
  }
}
