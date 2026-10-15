# Tài liệu dự án

README ở gốc giới thiệu sản phẩm và cách chạy. Thư mục này chứa hợp đồng nghiệp vụ, kiến trúc và hướng dẫn kỹ thuật; đặc tả không đồng nghĩa tính năng đã được triển khai.

| Nhóm                    | Tài liệu                                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tổng quan               | [01 — Dự án](01-project-overview.md), [02 — Yêu cầu](02-requirements.md), [16 — Lộ trình](16-roadmap.md)                                                                                                                                                  |
| Người dùng và nghiệp vụ | [03 — Vai trò](03-user-roles-permissions.md), [04 — Xác thực](04-authentication-authorization.md), [05 — Luồng](05-user-flows.md), [06 — Use case](06-use-cases.md), [07 — Quy tắc](07-business-rules.md)                                                 |
| Quyết định              | [17 — ADR](17-architecture-decisions.md), [18 — Quyết định còn mở](18-open-questions.md), [23 — Tổ chức, duyệt, seat map](23-organization-review-seatmap.md)                                                                                              |
| Backend và dữ liệu      | [08 — Database](08-database-design.md), [09 — API](09-api-design.md), [10 — Backend](10-backend-architecture.md), [11 — Concurrency](11-booking-concurrency.md), [20 — SQL vật lý](20-physical-sql-design.md), [21 — Transaction](21-sql-transactions.md) |
| Frontend và UI           | [22 — Kiến trúc FE](22-frontend-architecture.md), [25 — Brief và prompt thiết kế UI](25-ui-design-brief.md) |
| Chất lượng và vận hành  | [12 — Bảo mật](12-security.md), [13 — Kiểm thử](13-testing-strategy.md), [14 — Triển khai](14-environment-deployment.md), [15 — Quy tắc phát triển](15-development-rules.md), [24 — Local setup và rà soát](24-local-development.md)                      |
| Sơ đồ                   | [19 — Kiến trúc và chỉ mục sơ đồ Mermaid](19-system-diagrams.md) |

Nguồn quy tắc làm việc: [PROJECT_RULES.md](../PROJECT_RULES.md), [AGENTS.md](../AGENTS.md). Tiến độ auth: [26 — Auth](26-auth-progress.md). DDL và dữ liệu mẫu: [database](../database/README.md).

Cập nhật nghiệp vụ: [23 — Tổ chức, thay đổi sự kiện, feedback và uy tín](23-organization-review-seatmap.md). Prompt thiết kế: [25 — Brief UI](25-ui-design-brief.md).

- [27 — Cấu hình Gmail SMTP và test auth](27-email-otp-setup.md).
- [28 — Upload ảnh R2, presigned URL và CORS](28-r2-image-upload.md).
- [29 — Hồ sơ, theo dõi/thông báo, tuổi và thông tin mỗi vé](29-profile-follow-age-attendees.md).

- [30 — Rà soát và gộp schema attendee](30-schema-consolidation.md).
- [31 — Cấu trúc mã BE, phần dùng chung và validation](31-backend-code-structure.md).
- [32 — payOS, booking, phát vé và vào cửa](32-payos-booking-ticket-flow.md).

- [33 — Đăng ký cá nhân, onboarding và gợi ý](33-registration-onboarding.md).
- [34 — API Organizer, cấu hình sự kiện và Admin duyệt](34-organizer-event-api.md).

- [35 — Admin quản lý câu hỏi onboarding](35-admin-onboarding-questions.md).

- [36 — Rà soát số lượng bảng và khả năng gộp](36-schema-audit.md).
- [37 — Phạm vi hoàn tiền, đánh giá tổ chức và góp ý app](37-refunds-reviews-app-feedback.md).
- [38 — Bán vé, doanh thu và sửa/hủy sự kiện cho Organizer](38-organizer-sales-operations.md).
- [39 — Readiness, worker, restore và HTTPS local](39-backend-operational-readiness.md).
- [40 — Chức năng BE và phạm vi can thiệp Admin](40-backend-functional-completion.md).
- [41 — Search/autocomplete sự kiện Home](41-home-event-search.md).
- [42 — Vé outdoor theo khu/số lượng](42-outdoor-zone-ticketing.md).
- [43 — Phạm vi và nghiệm thu BE v1](43-backend-v1.md).

- [44 — Merchandise, mở bán lại, membership, uy tín và hợp đồng FE](44-backend-v1-extensions.md).
- [45 — Prisma thử nghiệm, transaction và RBAC hiện hành](45-prisma-pilot-rbac.md).
- [46 — API/UI quản trị RBAC động và chính sách cấp quyền](46-dynamic-rbac.md).
