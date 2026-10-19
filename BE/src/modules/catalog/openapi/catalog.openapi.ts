import {
  arrayOf,
  errorResponse,
  idParameter,
  ref,
  response,
} from '../../../shared/openapi/helpers.js';
export const catalogPaths = {
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
      description:
        'Bearer JWT tùy chọn: ẩn Organizer đã chặn theo User; response riêng tư no-store/Vary Authorization. from/to ISO có offset, [from,to); giá minor VND và availability phải thuộc cùng suất/cùng ghế. Không có JWT thì catalog Guest. Dữ liệu availability vẫn phải xác nhận lại khi hold.',
      parameters: [
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 120 } },
        { name: 'category', in: 'query', schema: { type: 'string', maxLength: 160 } },
        { name: 'city', in: 'query', schema: { type: 'string', maxLength: 120 } },
        { name: 'featured', in: 'query', schema: { type: 'boolean' } },
        { name: 'spotlight', in: 'query', schema: { type: 'boolean' } },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        {
          name: 'minPrice',
          in: 'query',
          schema: { type: 'string', pattern: '^(0|[1-9][0-9]{0,18})$' },
        },
        {
          name: 'maxPrice',
          in: 'query',
          schema: { type: 'string', pattern: '^(0|[1-9][0-9]{0,18})$' },
        },
        { name: 'available', in: 'query', schema: { type: 'boolean' } },
        {
          name: 'sort',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['recommended', 'date_asc', 'date_desc', 'price_asc', 'price_desc'],
          },
        },
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 },
        },
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
      parameters: [{ name: 'featured', in: 'query', schema: { type: 'boolean', default: false } }],
      responses: {
        '200': response('Danh sách Organizer.', arrayOf('Organizer')),
        '400': errorResponse('Bộ lọc không hợp lệ.'),
      },
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
          schema: {
            type: 'string',
            pattern: '^[1-9][0-9]{0,18}$',
            maxLength: 19,
            description: 'ID BIGINT tối đa 9223372036854775807.',
          },
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
};
