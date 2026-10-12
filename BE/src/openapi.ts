import { authPaths } from './modules/auth/openapi/auth.openapi.js';
import { bookingPaths, bookingSchemas } from './modules/bookings/openapi/booking.openapi.js';
import { catalogPaths } from './modules/catalog/openapi/catalog.openapi.js';
import { catalogSchemas } from './modules/catalog/openapi/catalog.openapi.schemas.js';
import { agePaths } from './modules/events/age/age.openapi.js';
import { mediaPaths } from './modules/media/openapi/media.openapi.js';
import { featurePaths } from './modules/notifications/openapi/notifications.openapi.js';
import { attendeePaths } from './modules/tickets/attendees/attendee.openapi.js';
import { usersPaths } from './modules/users/openapi/users.openapi.js';
import { onboardingPaths } from './modules/users/onboarding/onboarding.openapi.js';
import { eventManagementPaths } from './modules/events/management/event-management.openapi.js';
import { organizationPaths } from './modules/organizations/http/organization.openapi.js';
import { usersSchemas } from './modules/users/openapi/users.openapi.schemas.js';
import { systemPaths } from './shared/openapi/system.openapi.js';
import { systemSchemas } from './shared/openapi/system.openapi.schemas.js';
import { paymentPaths, ticketPaths } from './modules/payments/payment.openapi.js';
import { refundPaths } from './modules/refunds/refund.openapi.js';
import { feedbackPaths } from './modules/feedback/feedback.openapi.js';

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Event Ticketing API',
    version: '0.1.0',
    description:
      'Catalog, auth Customer, booking, payOS và phát vé. Nhân viên kiểm tra vé cần phiên Organizer và quyền trong đúng tổ chức.',
  },
  servers: [{ url: '/api/v1', description: 'Cùng origin với Public Web' }],
  tags: [
    { name: 'Refund', description: 'Hoàn toàn bộ thủ công, thu hồi vé và report scope.' },
    { name: 'Feedback', description: 'Đánh giá tổ chức và góp ý app riêng tư.' },
    { name: 'Organizer', description: 'Tổ chức và sự kiện nháp theo onboarding.' },
    { name: 'Admin', description: 'Duyệt tổ chức và sự kiện trước mở bán.' },
    { name: 'Booking', description: 'Giữ ghế, tạo/hủy đơn.' },
    {
      name: 'Payment',
      description: 'Một kênh payOS VND, callback có chữ ký và đối soát tiền muộn.',
    },
    {
      name: 'Tickets',
      description: 'Phát vé sau xác nhận tiền, check-in và đối chiếu giấy tờ tại cửa.',
    },
    { name: 'Waiting room', description: 'FIFO Redis và kiểm soát lượt vào mua.' },
    { name: 'Notifications', description: 'Theo dõi Organizer và inbox của chính User.' },
    { name: 'Age', description: 'Giới hạn tuổi theo ngày diễn ra suất.' },
    { name: 'Attendees', description: 'Thông tin riêng mỗi vé và đối chiếu giấy tờ tại cửa.' },
    { name: 'Users', description: 'Hồ sơ cá nhân của người đăng nhập.' },
    {
      name: 'Media',
      description: 'Upload ảnh trực tiếp lên Cloudflare R2 bằng presigned PUT URL.',
    },
    { name: 'Health', description: 'Liveness và readiness của API.' },
    { name: 'Catalog', description: 'Dữ liệu public đã được duyệt và xuất bản.' },
    {
      name: 'Auth',
      description: 'Google OAuth, email OTP, liên kết identity và phiên JWT/refresh cookie.',
    },
  ],
  paths: {
    ...refundPaths,
    ...feedbackPaths,
    ...onboardingPaths,
    ...eventManagementPaths,
    ...organizationPaths,
    ...paymentPaths,
    ...ticketPaths,
    ...featurePaths,
    ...agePaths,
    ...attendeePaths,
    ...bookingPaths,
    ...authPaths,
    ...mediaPaths,
    ...usersPaths,
    ...systemPaths,
    ...catalogPaths,
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: { ...bookingSchemas, ...usersSchemas, ...systemSchemas, ...catalogSchemas },
  },
} as const;
