type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (name: string): Schema => ({ type: 'array', items: ref(name) });
const envelope = (data: Schema): Schema => ({
  type: 'object',
  required: ['data', 'meta'],
  properties: {
    data,
    meta: ref('ResponseMeta'),
  },
});
const response = (description: string, data: Schema) => ({
  description,
  content: { 'application/json': { schema: envelope(data) } },
});
const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref('ErrorEnvelope') } },
});
const idParameter = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', pattern: '^[a-zA-Z0-9-]+$' },
});

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Event Ticketing API',
    version: '0.1.0',
    description:
      'API catalog công khai dùng chung cho Customer và Organizer. Auth, booking, payment và mutation Organizer vẫn theo hợp đồng đích trong Docs/09.',
  },
  servers: [{ url: '/api/v1', description: 'Cùng origin với Public Web' }],
  tags: [
    { name: 'Health', description: 'Liveness và readiness của API.' },
    { name: 'Catalog', description: 'Dữ liệu public đã được duyệt và xuất bản.' },
  ],
  paths: {
    '/health/live': {
      get: {
        tags: ['Health'],
        operationId: 'getLiveness',
        summary: 'Kiểm tra process API',
        responses: { '200': response('API đang chạy.', ref('HealthStatus')) },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        operationId: 'getReadiness',
        summary: 'Kiểm tra kết nối và schema catalog',
        responses: {
          '200': response('API và database sẵn sàng.', ref('ReadyStatus')),
          '503': errorResponse('Database chưa sẵn sàng hoặc thiếu migration catalog.'),
        },
      },
    },
    '/catalog/home': {
      get: {
        tags: ['Catalog'],
        operationId: 'getHomeCatalog',
        summary: 'Lấy toàn bộ graph dữ liệu trang chủ',
        responses: {
          '200': response('Catalog trang chủ.', ref('HomeCatalog')),
          '500': errorResponse('Lỗi nội bộ an toàn.'),
        },
      },
    },
    '/event-categories': {
      get: {
        tags: ['Catalog'],
        operationId: 'listEventCategories',
        summary: 'Danh sách danh mục đang hoạt động',
        responses: { '200': response('Danh mục sự kiện.', arrayOf('EventCategory')) },
      },
    },
    '/events': {
      get: {
        tags: ['Catalog'],
        operationId: 'listEvents',
        summary: 'Tìm và lọc sự kiện public',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string', maxLength: 120 } },
          { name: 'category', in: 'query', schema: { type: 'string', maxLength: 160 } },
          { name: 'city', in: 'query', schema: { type: 'string', maxLength: 120 } },
          { name: 'featured', in: 'query', schema: { type: 'boolean' } },
          { name: 'spotlight', in: 'query', schema: { type: 'boolean' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 24 },
          },
        ],
        responses: {
          '200': response('Danh sách sự kiện.', arrayOf('Event')),
          '400': errorResponse('Bộ lọc không hợp lệ.'),
        },
      },
    },
    '/events/{eventId}': {
      get: {
        tags: ['Catalog'],
        operationId: 'getEvent',
        summary: 'Chi tiết sự kiện theo public ID',
        parameters: [idParameter('eventId', 'Public ID của sự kiện.')],
        responses: {
          '200': response('Chi tiết sự kiện.', ref('Event')),
          '400': errorResponse('ID không hợp lệ.'),
          '404': errorResponse('Không tìm thấy sự kiện public.'),
        },
      },
    },
    '/organizers': {
      get: {
        tags: ['Catalog'],
        operationId: 'listOrganizers',
        summary: 'Danh sách Organizer đã duyệt',
        parameters: [
          { name: 'featured', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: { '200': response('Danh sách Organizer.', arrayOf('Organizer')) },
      },
    },
    '/organizers/{organizerId}': {
      get: {
        tags: ['Catalog'],
        operationId: 'getOrganizer',
        summary: 'Hồ sơ Organizer public',
        parameters: [idParameter('organizerId', 'Public ID của Organizer.')],
        responses: {
          '200': response('Hồ sơ Organizer.', ref('Organizer')),
          '400': errorResponse('ID không hợp lệ.'),
          '404': errorResponse('Không tìm thấy Organizer.'),
        },
      },
    },
    '/venues': {
      get: {
        tags: ['Catalog'],
        operationId: 'listVenues',
        summary: 'Danh sách venue đang hoạt động',
        parameters: [{ name: 'city', in: 'query', schema: { type: 'string', maxLength: 120 } }],
        responses: {
          '200': response('Danh sách venue.', arrayOf('Venue')),
          '400': errorResponse('Bộ lọc không hợp lệ.'),
        },
      },
    },
    '/venues/{venueId}': {
      get: {
        tags: ['Catalog'],
        operationId: 'getVenue',
        summary: 'Chi tiết venue theo ID',
        parameters: [
          {
            name: 'venueId',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^\\d+$' },
          },
        ],
        responses: {
          '200': response('Chi tiết venue.', ref('Venue')),
          '400': errorResponse('ID không hợp lệ.'),
          '404': errorResponse('Không tìm thấy venue.'),
        },
      },
    },
    '/merchandise': {
      get: {
        tags: ['Catalog'],
        operationId: 'listMerchandise',
        summary: 'Danh sách merchandise public',
        responses: { '200': response('Danh sách merchandise.', arrayOf('Merchandise')) },
      },
    },
    '/merchandise/{productId}': {
      get: {
        tags: ['Catalog'],
        operationId: 'getMerchandise',
        summary: 'Chi tiết merchandise theo public ID',
        parameters: [idParameter('productId', 'Public ID của sản phẩm.')],
        responses: {
          '200': response('Chi tiết merchandise.', ref('Merchandise')),
          '400': errorResponse('ID không hợp lệ.'),
          '404': errorResponse('Không tìm thấy sản phẩm.'),
        },
      },
    },
    '/articles': {
      get: {
        tags: ['Catalog'],
        operationId: 'listArticles',
        summary: 'Danh sách bài viết public',
        responses: { '200': response('Danh sách bài viết.', arrayOf('Article')) },
      },
    },
    '/articles/{articleId}': {
      get: {
        tags: ['Catalog'],
        operationId: 'getArticle',
        summary: 'Chi tiết bài viết theo slug',
        parameters: [idParameter('articleId', 'Slug của bài viết.')],
        responses: {
          '200': response('Chi tiết bài viết.', ref('Article')),
          '400': errorResponse('Slug không hợp lệ.'),
          '404': errorResponse('Không tìm thấy bài viết.'),
        },
      },
    },
    '/event-change-requests': {
      get: {
        tags: ['Catalog'],
        operationId: 'listEventChangeRequests',
        summary: 'Hồ sơ thay đổi hoặc mở bán đã duyệt',
        responses: {
          '200': response('Danh sách hồ sơ được phép hiển thị.', arrayOf('EventChangeRequest')),
        },
      },
    },
    '/locations': {
      get: {
        tags: ['Catalog'],
        operationId: 'listLocations',
        summary: 'Danh sách thành phố trong catalog',
        responses: { '200': response('Danh sách địa điểm.', arrayOf('Location')) },
      },
    },
  },
  components: {
    schemas: {
      ResponseMeta: {
        type: 'object',
        required: ['requestId'],
        properties: { requestId: { type: 'string', format: 'uuid' } },
      },
      ErrorEnvelope: {
        type: 'object',
        required: ['error', 'meta'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['field', 'code'],
                  properties: { field: { type: 'string' }, code: { type: 'string' } },
                },
              },
            },
          },
          meta: ref('ResponseMeta'),
        },
      },
      HealthStatus: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['ok'] } },
      },
      ReadyStatus: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['ready'] } },
      },
      Event: {
        type: 'object',
        required: [
          'id',
          'title',
          'displayName',
          'category',
          'categorySlug',
          'image',
          'date',
          'dateLabel',
          'startsAt',
          'venue',
          'city',
          'startingPrice',
          'currency',
          'organizer',
          'organizerId',
          'description',
          'admission',
          'status',
          'featured',
          'spotlight',
        ],
        properties: {
          id: { type: 'string', example: 'fe2' },
          title: { type: 'string' },
          displayName: { type: 'string' },
          category: { type: 'string' },
          categorySlug: { type: 'string' },
          image: { type: 'string' },
          date: { type: 'string', format: 'date' },
          dateLabel: { type: 'string' },
          startsAt: { type: 'string', format: 'date-time' },
          venue: { type: 'string' },
          city: { type: 'string' },
          startingPrice: { type: 'string', pattern: '^\\d+$', example: '850000' },
          currency: { type: 'string', minLength: 3, maxLength: 3, example: 'VND' },
          organizer: { type: 'string' },
          organizerId: { type: 'string' },
          description: { type: 'string' },
          admission: { type: 'string', enum: ['numbered', 'quantity'] },
          status: {
            type: 'string',
            enum: ['on-sale', 'few-left', 'sold-out', 'coming-soon'],
          },
          badge: { type: 'string', nullable: true },
          featured: { type: 'boolean' },
          spotlight: { type: 'boolean' },
          reopeningNote: { type: 'string', nullable: true },
        },
      },
      Organizer: {
        type: 'object',
        required: [
          'id',
          'name',
          'avatar',
          'summary',
          'verified',
          'eventCount',
          'hasMerchandise',
          'category',
        ],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          avatar: { type: 'string' },
          summary: { type: 'string' },
          verified: { type: 'boolean' },
          eventCount: { type: 'integer', minimum: 0 },
          hasMerchandise: { type: 'boolean' },
          category: { type: 'string' },
          upcomingEventTitle: { type: 'string', nullable: true },
          upcomingEventDate: { type: 'string', nullable: true },
          upcomingEventId: { type: 'string', nullable: true },
        },
      },
      Merchandise: {
        type: 'object',
        required: [
          'id',
          'eventId',
          'eventTitle',
          'name',
          'description',
          'image',
          'price',
          'currency',
          'organizer',
          'organizerId',
          'requiresTicket',
        ],
        properties: {
          id: { type: 'string' },
          eventId: { type: 'string' },
          eventTitle: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          image: { type: 'string' },
          price: { type: 'string', pattern: '^\\d+$' },
          currency: { type: 'string', minLength: 3, maxLength: 3 },
          organizer: { type: 'string' },
          organizerId: { type: 'string' },
          badge: { type: 'string', nullable: true },
          requiresTicket: { type: 'boolean' },
        },
      },
      Article: {
        type: 'object',
        required: [
          'id',
          'image',
          'publishedAt',
          'date',
          'category',
          'readTime',
          'title',
          'excerpt',
          'paragraphs',
        ],
        properties: {
          id: { type: 'string' },
          image: { type: 'string' },
          publishedAt: { type: 'string', format: 'date-time' },
          date: { type: 'string' },
          category: { type: 'string' },
          readTime: { type: 'string' },
          title: { type: 'string' },
          excerpt: { type: 'string' },
          paragraphs: { type: 'array', items: { type: 'string' } },
        },
      },
      EventChangeRequest: {
        type: 'object',
        required: [
          'id',
          'eventId',
          'eventTitle',
          'organizer',
          'image',
          'type',
          'reason',
          'impactSummary',
          'status',
          'requestedAt',
        ],
        properties: {
          id: { type: 'string' },
          eventId: { type: 'string' },
          eventTitle: { type: 'string' },
          organizer: { type: 'string' },
          image: { type: 'string' },
          type: { type: 'string' },
          reason: { type: 'string' },
          impactSummary: { type: 'string' },
          status: { type: 'string', enum: ['APPROVED'] },
          requestedAt: { type: 'string', format: 'date-time' },
        },
      },
      EventCategory: {
        type: 'object',
        required: ['id', 'name', 'eventCount'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          eventCount: { type: 'integer', minimum: 0 },
        },
      },
      Location: {
        type: 'object',
        required: ['name', 'queryValue', 'eventCount', 'image'],
        properties: {
          name: { type: 'string' },
          queryValue: { type: 'string' },
          eventCount: { type: 'integer', minimum: 0 },
          image: { type: 'string' },
        },
      },
      Venue: {
        type: 'object',
        required: ['id', 'code', 'name', 'address', 'city', 'timezone', 'maxCapacity', 'version'],
        properties: {
          id: { type: 'string', pattern: '^\\d+$' },
          code: { type: 'string' },
          name: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          timezone: { type: 'string' },
          maxCapacity: { type: 'integer', minimum: 1 },
          version: { type: 'integer', minimum: 0 },
        },
      },
      HomeCatalog: {
        type: 'object',
        required: [
          'categories',
          'featuredEvents',
          'events',
          'spotlightEvents',
          'organizers',
          'merchandise',
          'articles',
          'reopeningRequests',
          'locations',
        ],
        properties: {
          categories: arrayOf('EventCategory'),
          featuredEvents: arrayOf('Event'),
          events: arrayOf('Event'),
          spotlightEvents: arrayOf('Event'),
          organizers: arrayOf('Organizer'),
          merchandise: arrayOf('Merchandise'),
          articles: arrayOf('Article'),
          reopeningRequests: arrayOf('EventChangeRequest'),
          locations: arrayOf('Location'),
        },
      },
    },
  },
} as const;
