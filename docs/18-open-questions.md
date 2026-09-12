# 18. Câu hỏi mở và quyết định cần xác nhận

Tất cả mục dưới đây đang là **DECISION REQUIRED**. Phương án đề xuất phục vụ review, không phải câu trả lời đã được duyệt. Chủ quyết định là vai trò đề nghị trong dự án cá nhân; chưa gán một người cụ thể.

## Danh sách quyết định

| ID | Cần quyết định | Phương án để cân nhắc | Chủ quyết định / tác động |
| --- | --- | --- | --- |
| Q-001 | TTL giữ ghế bao lâu? Checkout có gia hạn? Chốt payment theo lúc provider nhận tiền hay lúc server xử lý? Có grace period không? | Đề xuất 5 phút, checkout không gia hạn, phân xử bằng giờ DB dưới khóa; SUCCESS muộn đi đối soát/hoàn | Product + Backend; FR-013/FR-019, BR-003/BR-007/BR-012, ADR-005; chốt trước phase 3 |
| Q-002 | Tối đa ghế/đơn, hold đang hoạt động/user/session; chống gom ghế; có gia hạn hoặc cooldown không? | Ví dụ để review: 6 ghế/đơn, 1 hold active/user/session, không gia hạn; cần thiết kế quota lock nếu áp dụng | Product + Security; FR-013, BR-008; phase 3 |
| Q-003 | Currency, đơn vị tiền, thuế/phí/chiết khấu; vé miễn phí; thời điểm khóa giá; Organizer được đổi giá đang giữ không? | Đề xuất một currency ban đầu, snapshot giá lúc hold và giữ đến expiry; không phí ẩn/discount; vé miễn phí cần luồng xác nhận riêng | Product; FR-012, BR-009; phase 2–4 |
| Q-004 | Có refund MVP không? Ai duyệt, trước giờ diễn bao lâu, phí nào; vé đã dùng/hết hạn; bán lại ghế; tự hoàn khoản SUCCESS muộn; provider thật nào? | Đề xuất mock hoàn toàn bộ vé chưa dùng, Admin duyệt, ghế chưa mở bán lại; compensation được theo dõi riêng; chưa tự chạy tiền thật | Product + vận hành; FR-020/FR-026/FR-027, BR-017–BR-019; phase 4 và trước production |
| Q-005 | Ai được Organizer, quy trình duyệt/hồ sơ; đa vai trò; Admin có được tạo/mua vé; quyền hỗ trợ xem đơn; quản lý danh mục; cấp Admin đầu tiên? | Đề xuất RBAC đa vai trò, cần Customer riêng để mua; Admin kiểm duyệt bằng permission rõ; bootstrap ngoài đăng ký công khai | Product + Security; FR-005, ma trận quyền, BR-020/BR-026; phase 1 |
| Q-006 | Xác minh email trước login/mua? Nhà cung cấp email; normalize email; password policy; access/refresh/reset TTL; đa thiết bị; MFA Admin? | Đề xuất access 10 phút, refresh 7 ngày tuyệt đối, reset 15 phút, verify 24 giờ; xác minh trước mua; giới hạn thiết bị/chính sách MFA cần chốt | Product + Security; FR-001–FR-004, ADR-003; phase 1 |
| Q-007 | Một booking được chứa nhiều session không? Người sở hữu vé là người mua hay từng người tham dự? Có chuyển nhượng/guest checkout? | Đề xuất một session/booking, đăng nhập bắt buộc, chủ booking sở hữu vé, chưa chuyển nhượng | Product; FR-014/FR-015, BR-006, mô hình Ticket; phase 3 |
| Q-008 | Ai quét vé, thời gian check-in, có ra/vào lại hay offline, có đối chiếu danh tính không? | Đề xuất Organizer sở hữu check-in online một lần; chưa nhân viên phụ/offline; cửa sổ thời gian phải chốt | Product + vận hành; FR-018, BR-015/BR-016, ADR-007; phase 4 |
| Q-009 | Venue dùng chung hay riêng Organizer? Ai sửa sơ đồ; ghế đánh số có đủ; cần vé đứng/khu tự do? | Đề xuất venue sở hữu riêng, sơ đồ tọa độ đơn giản, ghế đánh số; khóa cấu trúc sau mở bán | Product + Data; FR-010/FR-011, BR-021; phase 2 |
| Q-010 | Event publish cần Admin duyệt không? Hủy/block tác động vé và check-in thế nào? Đổi lịch/venue đã bán? Trùng giờ venue có được phép? | Đề xuất Organizer đã duyệt tự publish; block dừng bán và vào cửa đến khi xử lý; không sửa cấu trúc đã bán; hủy kích hoạt quy trình refund theo Q-004 | Product + vận hành; FR-007/FR-011, BR-005/BR-021/BR-022; phase 2/4 |
| Q-011 | Tải mục tiêu, số ghế/session, latency/error budget, accessibility/performance phía khách; mức availability? | Đề xuất benchmark 100 khách đồng thời/1.000 ghế; p95 đọc 500 ms, hold 1 s; 5xx < 1%; availability demo 99,5%; cần cấu hình máy cụ thể | Product + kỹ thuật; NFR-005/NFR-006, testing; phase 5 |
| Q-012 | Hosting/domain/topology, single/multiple instance, ngân sách, backup/RPO/RTO, ai trực vận hành? | Đề xuất một API + worker cùng codebase, MySQL, HTTPS reverse proxy; RPO 24h/RTO 4h cho demo để review; không mặc định đủ cho kinh doanh thật | Chủ dự án + vận hành; NFR-006/NFR-009/NFR-013; phase 5 |
| Q-013 | Retention PII/audit/token/inbox/idempotency/backup, xóa hoặc ẩn danh tài khoản, consent email/AI? | Đề xuất key request 24h, payment reference giữ theo chính sách giao dịch; retention dữ liệu còn lại chưa chốt, không tự áp dụng thời hạn pháp lý | Product + người phụ trách dữ liệu; NFR-010/NFR-013, FR-024; trước dữ liệu thật |
| Q-014 | Tìm tiếng Việt có/không dấu, prefix hay chứa từ; vùng/ngôn ngữ; poster/upload; sơ đồ và khả năng truy cập UI; frontend MVP cần những màn hình nào? | Đề xuất tiếng Việt, prefix search, màn hình theo [05](05-user-flows.md), sơ đồ đơn giản, chưa upload; thử usability trước mở rộng | Product + Frontend; FR-009/FR-010, NFR-012; phase 2 |
| Q-015 | AI có nhu cầu thật nào, dữ liệu đủ chưa, ngân sách/model/provider, consent, metric chất lượng? | Hoãn; chỉ chọn một tính năng sau baseline không AI và eval; AI không tự thao tác tiền/quyền | Product + kỹ thuật; FR-028, ADR-010; phase 8 |
| Q-016 | Phiên bản Node/MySQL, package manager, ORM/query builder, validation, test runner, migration tool, JWT algorithm/key management? | Chọn bản hỗ trợ phù hợp khi bắt đầu code; ưu tiên query layer biểu đạt được lock/transaction, kiểm thử MySQL thật; chưa pin phiên bản tùy ý trong docs | Kỹ thuật; ADR-002/ADR-003/ADR-008; phase 1 |
| Q-017 | Có tạo remote không, dịch vụ/tài khoản nào, public/private, license, branch protection và CI nào? | Hiện chỉ Git local nhánh main; chưa remote/push/license; chọn khi chủ dự án cung cấp đích | Chủ dự án; ADR-009; trước chia sẻ repo |
| Q-018 | Mốc thời gian, thời lượng làm mỗi tuần, thứ tự ưu tiên demo và tiêu chí được coi hoàn thành? | Theo các cổng nghiệm thu phase thay vì đặt ngày không có nguồn lực | Chủ dự án; roadmap; trước lập kế hoạch thời gian |

## Cách ghi nhận khi có câu trả lời

Giữ nguyên ID; thêm câu trả lời, người quyết định, ngày và trạng thái RESOLVED. Cập nhật đồng thời FR/BR, schema/API/state machine/test/ADR bị ảnh hưởng. Nếu thay đổi phương án, không giữ hai chính sách trái nhau trong tài liệu. Không chặn công việc độc lập chỉ vì một Q thuộc phase sau chưa có câu trả lời.

Ưu tiên trước code nền tảng: Q-005, Q-006, Q-016. Trước logic đặt vé: Q-001, Q-002, Q-003, Q-007; trước tiền/vé: Q-004, Q-008, Q-010. Các quyết định hosting, dữ liệu thật và remote cần chốt trước hành động tương ứng.

## Bản đồ bao phủ yêu cầu gốc

| Mục yêu cầu gốc | Tài liệu |
| --- | --- |
| 1. Tổng quan | [01](01-project-overview.md) |
| 2. Vai trò | [03](03-user-roles-permissions.md) |
| 3–4. Authentication, authorization | [04](04-authentication-authorization.md), [03](03-user-roles-permissions.md) |
| 5. Chức năng | [02](02-requirements.md) |
| 6–9. Business rules, booking/payment/ticket states | [07](07-business-rules.md) |
| 10. Giữ ghế/đồng thời | [11](11-booking-concurrency.md) |
| 11. Database | [08](08-database-design.md) |
| 12–13. API và error | [09](09-api-design.md) |
| 14–15. Kiến trúc và validation | [10](10-backend-architecture.md) |
| 16–17. Security/logging/auditing | [12](12-security.md) |
| 18. Phi chức năng | [02](02-requirements.md) |
| 19. User flows | [05](05-user-flows.md) |
| 20. Use cases | [06](06-use-cases.md) |
| 21–24. Search, notification, realtime, AI | [02](02-requirements.md), [16](16-roadmap.md) |
| 25. Testing | [13](13-testing-strategy.md) |
| 26. Environment | [14](14-environment-deployment.md) |
| 27–28. Git/code rules | [15](15-development-rules.md), [PROJECT_RULES](../PROJECT_RULES.md) |
| 29. Roadmap | [16](16-roadmap.md) |
| 30. ADR | [17](17-architecture-decisions.md) |
| 31. Open questions | Tài liệu này |
