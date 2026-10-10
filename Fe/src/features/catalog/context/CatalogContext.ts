import { createContext } from 'react';
import type { HomeCatalog } from '../types';

export interface CatalogContextValue {
  catalog: HomeCatalog;
  reload: () => void;
}

export const CatalogContext = createContext<CatalogContextValue | null>(null);
