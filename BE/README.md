# Backend

Quản trị RBAC động cần migration018: API `/api/v1/admin/rbac`, UI FE `/admin/rbac`, ADMIN+rbac.manage; tạo/sửa/lưu trữ role bổ sung và cấp/thu hồi ADMIN người khác có reauth/version/idempotency/audit. [Docs46](../Docs/46-dynamic-rbac.md), trạng thái kiểm chứng local tại Docs26. Không dùng Prisma migration cho schema này.

BE v1 gồm lõi bán vé và merchandise/mở bán lại/membership/uy tín đã chốt theo [Docs43](../Docs/43-backend-v1.md)/[Docs44](../Docs/44-backend-v1-extensions.md); CMS sau v1. `npm run check:v1` chạy quality và PostgreSQL/Elasticsearch integration, không tính skipped là đã kiểm chứng. Schema hiện hành cần đủ migrations001–018; log apply/kiểm tra tại Docs26.

Cấu trúc code, trách nhiệm từng folder/file và phần dùng chung tại [Docs/31](../Docs/31-backend-code-structure.md). Routes khai báo HTTP/middleware; controller xử lý input/output; service giữ use case/transaction; repository giữ SQL. Auth/booking/catalog và OpenAPI đã tách theo trách nhiệm. `src/startup/` thay `src/Bootstrap/`.

Module lớn gom vào thư mục con: auth có google/otp/session/account/http/shared/openapi; bookings có holds/orders/allocation/inventory/waiting-room/shared/openapi. Catalog/module nhỏ gom HTTP/schema/service/repository/OpenAPI theo tầng; events/age và tickets/attendees gom theo chức năng. Cây folder tại Docs/31.

Validation dùng Zod tại biên API; query catalog/phân trang được kiểm tra chặt, ID nằm trong BIGINT, version trong INTEGER. Mutation có body cần application/json; sai Content-Type trả 415. `npm run check` kiểm tra secret/lint/TypeScript/test/build/format; test hiện tại dùng fixture, không đọc `.env` thật hoặc gửi email.

ADR-023: hồ sơ có gender/DOB private; API follow/inbox, event minimumAge/ageTag, attendee mỗi vé và staff đối chiếu CCCD đã có. Chạy `npm run worker:notifications` trong terminal BE riêng để phát notification/purge CCCD; API không tự chạy worker. Khởi động lại BE sau migration/cấu hình key. Chi tiết và giới hạn tại [Docs/29](../Docs/29-profile-follow-age-attendees.md).

Hồ sơ cá nhân đã có `GET/PATCH /api/v1/users/me`: đọc tên/avatar và sửa tên hiển thị của chính User theo quyền DB. Xem [module users](src/modules/users/README.md); FE sửa tên chưa nối.

Upload ảnh dùng Cloudflare R2: `POST /api/v1/media/uploads` cấp presigned PUT 5 phút, client upload trực tiếp rồi gọi `/media/uploads/complete` để BE xác minh và lưu URL. Avatar/event/merchandise tuân thủ quyền DB và ownership; xem [cấu hình, migration và CORS](../Docs/28-r2-image-upload.md).

Express + TypeScript + PostgreSQL qua `pg`, modular monolith. Preference Customer ẩn/bỏ ẩn Organizer thử Prisma7.10.0, dùng cùng pool và guard/ORM trong một transaction; hold/payment/refund giữ pg. `npm ci` sinh client; SQL migration vẫn quản lý DDL, không chạy Prisma Migrate/db push trên projection. [Phạm vi và đánh giá](../Docs/45-prisma-pilot-rbac.md). Cấu hình riêng ở `.env`; mẫu an toàn ở `.env.example`. Không commit `.env`.

Giai đoạn phát triển dùng một API instance; chủ dự án đã yêu cầu bỏ load balancer để ưu tiên hoàn thiện sản phẩm. `compose.yml` chỉ còn Redis local cho phòng chờ/rate limit, có thể khởi động bằng `npm run infra:redis`; BE vẫn chạy bằng `npm run dev`. Không có Nginx, Dockerfile đóng gói API hoặc lệnh dev:scaled. Code booking/hold/phòng chờ hiện có được làm sạch và kiểm tra trong phạm vi [Docs/31](../Docs/31-backend-code-structure.md); payOS/phát vé/check-in/admission đã nối FE và qua kiểm thử provider giả; giao dịch chuyển tiền thật chưa thử. Xem [Docs/32](../Docs/32-payos-booking-ticket-flow.md).

Chạy ngay trong **BE/** bằng `npm run dev`, mặc định cổng **3000**; FE ở terminal riêng, cổng **5173**. Trên Windows dùng runtime nvm chung:

```powershell
. .\scripts\use-node.ps1
npm.cmd run dev
```

Tạo schema/seed bằng DBeaver theo [database README](../database/README.md), sau đó chạy `npm run db:check` trong BE để kiểm tra kết nối và schema nghiệp vụ bằng truy vấn chỉ đọc. Schema hiện hành có51 bảng và mốc migration017. Dependency và lockfile nằm ngay trong `BE/`; không chạy npm từ gốc repository. `.env` được tìm theo đường dẫn module nên không phụ thuộc thư mục gọi lệnh. Hướng dẫn đầy đủ: [môi trường local](../Docs/24-local-development.md).

`src/app.ts` không tự mở cổng, nhận dependency để test; `src/server.ts` mở cổng và đóng pool. Module `catalog` triển khai repository/service/router cho Public Web. Các endpoint đọc hiện có:

- Swagger UI: `GET /api/docs/`
- OpenAPI JSON: `GET /api/v1/openapi.json`

- `GET /api/v1/catalog/home`
- `GET /api/v1/event-categories`, `/events`, `/events/:id`
- `GET /api/v1/organizers`, `/organizers/:id`
- `GET /api/v1/venues`, `/venues/:id`
- `GET /api/v1/merchandise`, `/merchandise/:id`
- `GET /api/v1/articles`, `/articles/:id`
- `GET /api/v1/event-change-requests`, `/locations`

Catalog chỉ trả event `PUBLISHED` và hồ sơ thay đổi đã duyệt. ID/tiền là chuỗi. Cấu hình auth ở [module auth](src/modules/auth/README.md), [hold/booking](src/modules/bookings/README.md), [payOS](src/modules/payments/README.md) và [API Organizer/Admin](../Docs/34-organizer-event-api.md). `src/shared/database/transaction.ts` cung cấp một connection cho toàn transaction, không gọi mạng trong transaction. `npm run dev` chạy riêng API; launcher `start:monolith` chạy API cùng hai worker. Migration áp dụng có kiểm soát, không tự chạy lúc startup.

Runtime Windows dùng chung Node 24.21.0 tại `D:\NVM\installs` (npm 11.19.0). Chạy `. .\scripts\use-node.ps1` trước khi chạy npm.cmd; helper chỉ đổi PATH phiên hiện tại, không còn runtime riêng hoặc fallback `.local`. Xem Docs/24-local-development.md.

Onboarding và Organizer cá nhân theo [Docs/33](../Docs/33-registration-onboarding.md) và [Docs/34](../Docs/34-organizer-event-api.md). `npm run test:commerce` chạy fresh/upgrade và integration trên PG tạm; đặt COMMERCE_TEST_BROWSER=1 sau FE build để kiểm chứng onboarding→purchase bằng Edge. Không gọi payOS/SMTP thật trong tests. Cách nâng từng phiên bản DB và trạng thái apply đã ghi tại database/README và Docs/26; không chạy lại migration đã có.

Refund/report/feedback APIs theo [Docs37](../Docs/37-refunds-reviews-app-feedback.md): hoàn thủ công có chứng từ, tổ chức duyệt/Admin theo report; đánh giá tổ chức và góp ý app riêng tư. FE chức năng mới chưa nối; không tự chuyển tiền hoặc cấp Admin thật.

## Home event search

Elasticsearch một instance đã được chấp thuận ADR-036; English/fuzzy/N-gram/prefix/completion, Redis candidates15s và PostgreSQL hydrate dữ liệu hiện hành. npm run search:setup → infra:search → apply015 khi cần → search:reindex; notifications worker hiện có đồng bộ outbox. DB local đã apply015, không chạy lại. npm run test:search chạy PG + ES thật trong fixture riêng và dọn index/API key. [Setup/hợp đồng/consistency/limits](../Docs/41-home-event-search.md).

## Indoor/outdoor

NUMBERED indoor/QUANTITY outdoor theo khu đã có BE. POST Organizer zone-layouts và PUT zone-prices, GET public zones/POST zones/hold, cùng checkout/payment/tickets/attendees/refund/cancel. Không ghế vật lý giả, giữ6 vé/hold5 phút. Migration016 dùng lại47 bảng. Health Admin/API dùng chung readiness có Elasticsearch. [Docs42](../Docs/42-outdoor-zone-ticketing.md).
