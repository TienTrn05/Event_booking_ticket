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
      'API catalog công khai và Google OAuth 2.0 Authorization Code + PKCE/JWT. Email OTP Customer qua SMTP Gmail và liên kết Google/email cùng tài khoản. Booking, payment và mutation Organizer vẫn theo hợp đồng đích trong Docs/09.',
  },
  servers: [{ url: '/api/v1', description: 'Cùng origin với Public Web' }],
  tags: [
    { name: 'Health', description: 'Liveness và readiness của API.' },
    { name: 'Catalog', description: 'Dữ liệu public đã được duyệt và xuất bản.' },
    {
      name: 'Auth',
      description: 'Google OAuth, email OTP, liên kết identity và phiên JWT/refresh cookie.',
    },
  ],
  paths: {
    '/auth/config': {
      get: {
        tags: ['Auth'],
        operationId: 'getAuthConfig',
        summary: 'Kiểm tra cấu hình Google, email OTP và session',
        responses: {
          '200': response('Cấu hình công khai.', {
            type: 'object',
            properties: {
              googleEnabled: { type: 'boolean' },
              emailOtpEnabled: { type: 'boolean' },
              sessionEnabled: { type: 'boolean' },
            },
          }),
        },
      },
    },
    '/auth/csrf': {
      get: {
        tags: ['Auth'],
        operationId: 'getAuthCsrf',
        summary: 'Nhận CSRF token cho các POST auth',
        responses: {
          '200': response('CSRF token.', {
            type: 'object',
            properties: { csrfToken: { type: 'string' } },
          }),
          '503': errorResponse('Auth chưa cấu hình.'),
        },
      },
    },
    '/auth/google/start': {
      post: {
        tags: ['Auth'],
        operationId: 'startGoogleAuth',
        summary: 'Bắt đầu Google Authorization Code + PKCE',
        description:
          'link=true cần Bearer JWT/phiên EMAIL mới trong 5 phút; Google cùng email đã xác minh.',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: { link: { type: 'boolean', default: false } },
              },
            },
          },
        },
        parameters: [
          { name: 'x-csrf-token', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': response('URL Google để trình duyệt chuyển đến.', {
            type: 'object',
            properties: { authorizationUrl: { type: 'string', format: 'uri' } },
          }),
          '403': errorResponse('Origin hoặc CSRF không hợp lệ.'),
        },
      },
    },
    '/auth/google/callback': {
      get: {
        tags: ['Auth'],
        operationId: 'finishGoogleAuth',
        summary: 'Google callback; đặt refresh cookie và redirect về web',
        responses: { '302': { description: 'Về web với kết quả đăng nhập.' } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        operationId: 'refreshAuth',
        summary: 'Xoay refresh cookie và nhận access JWT',
        parameters: [
          { name: 'x-csrf-token', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': response('Access token và người dùng.', {
            type: 'object',
            properties: { accessToken: { type: 'string' }, user: { type: 'object' } },
          }),
          '401': errorResponse('Phiên không hợp lệ hoặc token bị dùng lại.'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        operationId: 'logoutAuth',
        summary: 'Thu hồi phiên hiện tại',
        parameters: [
          { name: 'x-csrf-token', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: { '204': { description: 'Đã thu hồi phiên.' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        operationId: 'getAuthMe',
        summary: 'Kiểm tra access JWT và phiên trong database',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': response('Người dùng hiện tại.', { type: 'object' }),
          '401': errorResponse('Chưa đăng nhập.'),
        },
      },
    },
    '/auth/methods': {
      get: {
        tags: ['Auth'],
        operationId: 'getOwnLoginMethods',
        summary: 'Phương thức đăng nhập đã liên kết của chính User',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': response('Metadata tài khoản, không phải quyền.', {
            type: 'object',
            properties: {
              email: { type: 'string', nullable: true },
              googleLinked: { type: 'boolean' },
              emailLinked: { type: 'boolean' },
              phones: { type: 'array', items: { type: 'string' } },
            },
          }),
          '401': errorResponse('Access token/phiên không hợp lệ.'),
        },
      },
    },
    '/auth/otp/request': {
      post: {
        tags: ['Auth'],
        operationId: 'requestEmailOtp',
        summary: 'Gửi OTP qua email; SĐT chỉ là alias tra email',
        description:
          'LINK_IDENTITY cần Bearer JWT và phiên mới trong 5 phút, email khớp identity hiện tại. Không trả email tra từ SĐT hoặc mã OTP.',
        parameters: [
          { name: 'x-csrf-token', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['identifier'],
                properties: {
                  identifier: { type: 'string', maxLength: 254 },
                  phone: { type: 'string', maxLength: 32 },
                  purpose: { type: 'string', enum: ['LOGIN', 'LINK_IDENTITY'], default: 'LOGIN' },
                },
              },
            },
          },
        },
        responses: {
          '202': response('Kết quả chung; kiểm tra inbox/thư rác nếu thông tin hợp lệ.', {
            type: 'object',
            required: ['challengeId', 'expiresIn', 'resendAfter'],
            properties: {
              challengeId: { type: 'string' },
              expiresIn: { type: 'integer', example: 300 },
              resendAfter: { type: 'integer', example: 60 },
            },
          }),
          '400': errorResponse('Dữ liệu không hợp lệ.'),
          '401': errorResponse('Cần đăng nhập lại trước khi liên kết.'),
          '403': errorResponse('Origin/CSRF không hợp lệ.'),
          '409': errorResponse('Email không khớp.'),
          '429': errorResponse('Vượt giới hạn gửi/thử mã.'),
          '503': errorResponse('Email chưa cấu hình hoặc gửi thất bại.'),
        },
      },
    },
    '/auth/otp/verify': {
      post: {
        tags: ['Auth'],
        operationId: 'verifyEmailOtp',
        summary: 'Xác minh OTP và đăng nhập/liên kết cùng User',
        description:
          'Cần cookie browser binding và CSRF. LINK_IDENTITY thêm Bearer JWT cho cùng User/phiên mới. Không tự merge email trùng.',
        parameters: [
          { name: 'x-csrf-token', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['challengeId', 'code'],
                properties: {
                  challengeId: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' },
                  code: { type: 'string', pattern: '^[0-9]{6}$' },
                },
              },
            },
          },
        },
        responses: {
          '200': response('JWT memory + refresh HttpOnly cookie.', {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              user: {
                type: 'object',
                properties: { id: { type: 'string' }, displayName: { type: 'string' } },
              },
            },
          }),
          '401': errorResponse('OTP sai/hết hạn/đã dùng hoặc cần login mới.'),
          '403': errorResponse('Origin/CSRF hoặc User bị block.'),
          '409': errorResponse('Cần liên kết hoặc identity/alias conflict.'),
        },
      },
    },
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
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
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
