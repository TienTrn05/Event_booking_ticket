import { response, errorResponse, arrayOf } from '../../shared/openapi/helpers.js';
const parameters = [
  { name: 'q', in: 'query', schema: { type: 'string', maxLength: 120 } },
  ...['category', 'city', 'from', 'to', 'minPrice', 'maxPrice', 'available'].map((name) => ({
    name,
    in: 'query',
    schema: { type: 'string' },
  })),
  {
    name: 'sort',
    in: 'query',
    schema: {
      type: 'string',
      enum: ['relevance', 'popular', 'date_asc', 'date_desc', 'price_asc', 'price_desc'],
    },
  },
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100000 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
];
const result = {
  type: 'object',
  properties: {
    items: arrayOf('Event'),
    total: { type: 'integer' },
    degraded: { type: 'boolean' },
    engine: { type: 'string' },
    pagination: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
        hasMore: { type: 'boolean' },
      },
    },
  },
};
const operation = (suggest: boolean) => ({
  tags: ['Search'],
  summary: suggest ? 'Public event autocomplete' : 'Search public events for Home',
  description:
    'Optional Bearer JWT applies personal Organizer visibility. English analysis, prefix/completion, N-gram and fuzzy matching. PostgreSQL revalidates current content fingerprint, publication, session filters, prices/availability and blocks. Cached index candidates never authorize visibility. Index outage falls back to PostgreSQL with degraded=true. q matches title, Organizer and venue. No browser access to Elasticsearch.',
  parameters,
  responses: {
    '200': response('Current public events and pagination.', result),
    '400': errorResponse('Invalid search filters.'),
    '401': errorResponse('Invalid supplied session.'),
    '422': errorResponse('Narrow a query matching over10000 sessions.'),
    '503': errorResponse('Search temporarily unavailable.'),
  },
});
export const searchPaths = {
  '/search/events': { get: operation(false) },
  '/search/events/suggestions': { get: operation(true) },
};
