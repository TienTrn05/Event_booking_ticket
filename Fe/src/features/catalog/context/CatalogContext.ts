import { createContext } from 'react';
import type { HomeCatalog } from '../types';

export interface CatalogContextValue {
  catalog: HomeCatalog;
  loading: boolean;
  error: boolean;
  reload: () => void;
}

export const CatalogContext = createContext<CatalogContextValue | null>(null);
