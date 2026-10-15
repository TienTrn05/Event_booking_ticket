# 43. Nghiệm thu BE v1

**Bổ sung sau rà soát 2026-10-15:** sửa expiry sau khóa/membership review/payment polling, ổn định fixture thời gian và pilot Prisma preference theo ADR-039. npm run check qua97 test và npm run test:search qua96 ca PostgreSQL/Elasticsearch,2 browser tùy chọn skipped. SQL migration/51 bảng/lõi tiền-vé giữ nguyên. [Phạm vi và RBAC](45-prisma-pilot-rbac.md), [log kiểm chứng](26-auth-progress.md).

Phạm vi chốt ngày2026-10-15 gồm lõi bán vé và **merchandise, mở bán lại, membership, uy tín** theo chấp thuận chủ dự án/ADR-038. CMS để sau v1. **Hoàn thành code và nghiệm thu local BE v1:** check:v1 qua (97 unit/HTTP và88 ca trong runner PostgreSQL/search,2 browser tùy chọn skipped), migration017 đã áp dụng local51 bảng, restore drill khớp dữ liệu/schema. Bằng chứng chi tiết tại [Docs26](26-auth-progress.md).

| Nhóm | Phạm vi BE v1 |
| --- | --- |
| Tài khoản | Google PKCE/email OTP, linking tường minh, JWT10 phút, refresh7 ngày/rotation, quản lý phiên/logout-all, onboarding/câu hỏi có phiên bản |
| Tổ chức/sự kiện | Nháp/duyệt tổ chức/event, indoor/outdoor, suất/loại vé/giá, submit/withdraw/expiry/reason notice, sửa nội dung qua duyệt |
| Bán vé | Redis waiting room, hold5 phút/6 vé/quota, checkout/idempotency, payOS/webhook/poll/retry, QR/attendee/đối chiếu/check-in/admission |
| Hậu mãi | Full manual refund/chứng từ, hủy trước suất/chưa USED, report scope, Admin gỡ event, audit/feedback private |
| Khám phá | Catalog/follow/inbox/gợi ý/ẩn Organizer, Home search/autocomplete Elasticsearch một instance và PG revalidation |
| Membership | Tổ chức ACTIVE, owner mời Organizer đã onboarding, accept/decline/revoke/version/replay; không cấp role/chuyển chủ |
| Uy tín | Prior3 sao/5 mẫu, 0–100/n<5 chưa đủ dữ liệu; ±20/report RESOLVED duy nhất/đảo append-only/snapshot; không tự approve/block |
| Mở bán lại | NEW_SALE_WAVE/CAPACITY Admin/version/snapshot; append inventory indoor/outdoor/shared layout trong venue, giữ lịch/giá/chỗ/vé/hold cũ |
| Merchandise | Product review/R2/SKU/stock; đơn một event/20 đơn vị/5 phút/payOS chung/ticket gate; địa chỉ mã hóa/giao VN/tracking/manual refund/report/revenue riêng |
| Vận hành | Readiness/heartbeat/supervisor một API/hai worker cùng máy, HTTPS local/restore drill/CI PG-search fixture |

Hợp đồng endpoint, payload, scope, version, khóa/stock, ERD và hướng dẫn FE ở [Docs44](44-backend-v1-extensions.md). Auth/provider/token/cookie/CSRF/linking và monolith giữ nguyên. Không tự cấp Admin thật, chuyển tiền hoặc deploy production để nghiệm thu.

## Thống kê và đối soát

GET /api/v1/admin/statistics?from&to cần ADMIN + statistics.read_system, no-store; ISO offset [from,to), bỏ cả hai lấy toàn lịch sử. Users/organizations/events là trạng thái hiện tại của thực thể được tạo trong khoảng. Bookings/tickets/money dùng cohort booking.created_at; aggregate riêng, không nhân tiền theo item/attempt.

Money tách currency, chuỗi minor: grossTicketSalesMinor tính mỗi đơn CONFIRMED/REFUNDED một lần; received gồm tiền cần đối soát; refunded chỉ SUCCESS; pending refund gồm REQUESTED/PROCESSING/FAILED; net=received−refunded. Reconciliation không tự coi là mua thành công.

merchandise.orders/money riêng theo merchandise_orders.created_at, có grossSalesMinor/received/refunded/pending/net/reconciliation. Organizer đọc /organizer/organizations/{organizationId}/merchandise-sales?from&to. Không payout/phí nền tảng hoặc trộn tiền hàng với vé. Order detail trả payment metadata để xử lý report; Admin không được xem địa chỉ.

## Cổng kiểm tra và giới hạn

Trong BE, npm run check:v1 chạy secret guard/lint/typecheck/unit/HTTP/architecture/build/format rồi PostgreSQL/Elasticsearch integration. Runner tạo cluster PG/index/API key riêng, kiểm tra fresh/populated upgrades007–017 và tự dọn; không tạo fixture vào DB ứng dụng. Không tính skipped trong npm test là đã kiểm chứng DB.

Các ca mới bao phủ membership accept/revoke/replay/quyền, prior/ẩn review/ledger nguồn duy nhất/đảo, SKU cuối/expiry/PII, partial/duplicate/late receipts/ticket gate, refund–shipment race/manual evidence/report, capacity indoor/outdoor/shared layout/window/version/bảo toàn inventory. Regression OTP dùng clock_timestamp() sau khóa, giữ TTL đã chốt.

Browser tùy chọn, Google/SMTP/R2/payOS thật, giao hàng/chuyển tiền thật, tải lớn/remote CI/staging/production có bằng chứng riêng. Chốt code BE v1 không đồng nghĩa dashboard FE hoặc vận hành production đã hoàn thành. CMS sau v1.

Repo giữ source/test chính thức/migration/backup/cấu hình local; đã loại dependency/code/file không dùng, placeholder/link hỏng. Build/cache/process/DB/index kiểm thử đã dọn sau nghiệm thu; backup và cấu hình ứng dụng được giữ. Không commit/push khi chưa yêu cầu.
