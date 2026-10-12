import { inputSchema, idempotencyHeader } from '../../../shared/openapi/input-schema.js';
import { body, common, result } from '../../../shared/openapi/feature-helpers.js';
import { onboardingInput, preferencesInput } from './onboarding.schema.js';
import { publishQuestionsInput, editAnswersInput } from './questions/questionnaire.schema.js';
const own = {
  ...common,
  tags: ['Users'],
  responses: { ...common.responses, '200': result({ type: 'object' }) },
};
export const onboardingPaths = {
  '/admin/onboarding/questions': {
    get: { ...own, tags: ['Admin'], summary: 'Bộ câu hỏi bổ sung hiện hành; onboarding.manage' },
    put: {
      ...own,
      tags: ['Admin'],
      summary: 'Admin thêm/bớt/sắp xếp/đặt bắt buộc câu hỏi bổ sung',
      description:
        'Giữ role/displayName/gender/DOB bắt buộc. Xuất bản phiên bản mới bằng questionnaireId hiện tại và Idempotency-Key; phiên bản cũ/câu trả lời được giữ. Không cấp lại quyền, không ép tài khoản đã hoàn tất trả lời lại.',
      parameters: [idempotencyHeader],
      requestBody: body(inputSchema(publishQuestionsInput)),
    },
  },
  '/users/me/onboarding/answers': {
    put: {
      ...own,
      summary: 'Sửa câu trả lời bổ sung theo phiên bản đăng ký của chính tôi',
      requestBody: body(inputSchema(editAnswersInput)),
    },
  },
  '/users/me/onboarding': {
    get: {
      ...own,
      operationId: 'getMyOnboarding',
      summary: 'Trạng thái hồ sơ và vai trò của phiên hiện tại',
    },
    put: {
      ...own,
      operationId: 'completeMyOnboarding',
      summary: 'Hoàn tất đăng ký và chọn Customer hoặc Organizer',
      description:
        'Google/email OTP đã xác minh. Role/displayName/gender/dateOfBirth luôn bắt buộc. Câu bổ sung theo questionnaireId/required trả từ options; chỉ được bỏ qua nếu không có câu bắt buộc. Admin thay bộ câu hỏi trả 409 ONBOARDING_QUESTIONNAIRE_CHANGED. answers chỉ chứa custom_*; category/city/follow dùng field hiện có. Không nhận ADMIN. Organizer chỉ nhận ORGANIZER, tạo nháp ngay; Admin duyệt trước mở bán. Retry cùng key/body. Origin đúng PUBLIC_APP_URL.',
      parameters: [idempotencyHeader],
      requestBody: body(inputSchema(onboardingInput)),
    },
  },
  '/users/me/onboarding/options': {
    get: {
      ...own,
      operationId: 'getOnboardingOptions',
      summary: 'Danh mục, thành phố và Organizer được duyệt để theo dõi',
    },
  },
  '/users/me/preferences': {
    put: {
      ...own,
      operationId: 'updateMyPreferences',
      summary: 'Thay sở thích và thành phố, cho phép xóa lựa chọn',
      requestBody: body(inputSchema(preferencesInput)),
    },
  },
  '/users/me/roles/customer': {
    post: {
      ...own,
      operationId: 'activateCustomerRole',
      summary: 'Organizer chủ động bật thêm quyền Customer',
      parameters: [idempotencyHeader],
      requestBody: body({ type: 'object', additionalProperties: false }),
    },
  },
  '/users/me/recommendations': {
    get: {
      ...own,
      operationId: 'recommendMyEvents',
      summary: 'Gợi ý theo quy tắc, chưa dùng AI',
      description:
        'Ưu tiên Organizer theo dõi, danh mục, thành phố, thời gian sắp diễn ra và mức phổ biến từ vé đã phát. Mỗi vị trí thứ tư dành cho khám phá. Chỉ sự kiện công khai của tổ chức được duyệt, có suất tương lai.',
      parameters: [
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 40, default: 12 },
        },
      ],
    },
  },
};
