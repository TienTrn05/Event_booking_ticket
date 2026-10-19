# Backend

Source trên GitHub không kèm `tests/`, cấu hình/harness Vitest hoặc tài liệu nội bộ. Chạy `npm run check:ci` để kiểm tra secret/Prisma/lint/typecheck/build/format từ bản clone; `npm run check`, `test:commerce` và `test:search` dành cho bản local có bộ test. Các tham chiếu Docs bên dưới là tài liệu local.

## Chạy trọn BE bằng Docker Compose

Sau khi cấu hình `BE/.env` và database hiện có, mở Docker Desktop rồi chạy ngay trong **BE/**:

```powershell
docker compose up -d --build --wait --wait-timeout 240
```

Một lệnh bật Redis, Elasticsearch và container ứng dụng chứa **một API + hai worker**. Không cần mở ba terminal hoặc cài Node trên máy chỉ để chạy gói Docker. FE vẫn chạy riêng. Xem log bằng `docker compose logs -f api`; dừng bằng `docker compose stop` (giữ volume). API mặc định http://127.0.0.1:3000, readiness `/api/v1/health/ready`.

PostgreSQL vẫn là database hiện có trên máy; container kết nối qua `host.docker.internal`. Nếu DB ở máy khác, đặt `DOCKER_DB_HOST` trong `.env`. Không tự tạo DB, chạy migration, seed hoặc reindex khi khởi động. Dừng API Node cũ trước khi dùng cùng cổng3000. Hướng dẫn setup lần đầu, xử lý kết nối và phạm vi production tại Docs49 (`../Docs/49-backend-packaging.md`, local).

Entrypoint vận hành nằm trong `src/runtime/`, được build vào `dist/runtime/`; `npm start` chạy bản build gồm API và hai worker. Image không chứa thư mục `scripts/`, TypeScript source, tests hoặc `.env`; `scripts/` chỉ giữ công cụ hỗ trợ local. CI dùng `check-secrets.mjs` ở gốc BE.

## Phát triển và bảo trì

Quản trị RBAC động cần migration018: API `/api/v1/admin/rbac`, UI FE `/admin/rbac`, ADMIN+rbac.manage; tạo/sửa/lưu trữ role bổ sung và cấp/thu hồi ADMIN người khác có reauth/version/idempotency/audit. Docs46 (`../Docs/46-dynamic-rbac.md`, local), trạng thái kiểm chứng local tại Docs26. Không dùng Prisma migration cho schema này.

BE v1 gồm lõi bán vé và merchandise/mở bán lại/membership/uy tín đã chốt theo Docs43 (`../Docs/43-backend-v1.md`, local)/Docs44 (`../Docs/44-backend-v1-extensions.md`, local); CMS sau v1. `npm run check:v1` chạy quality và PostgreSQL/Elasticsearch integration, không tính skipped là đã kiểm chứng. Schema hiện hành cần đủ migrations001–018; log apply/kiểm tra tại Docs26.

Cấu trúc code, trách nhiệm từng folder/file và phần dùng chung tại Docs/31 (`../Docs/31-backend-code-structure.md`, local). Routes khai báo HTTP/middleware; controller xử lý input/output; service giữ use case/transaction; repository giữ SQL. Auth/booking/catalog và OpenAPI đã tách theo trách nhiệm. `src/startup/` thay `src/Bootstrap/`.

Module lớn gom vào thư mục con: auth có google/otp/session/account/http/shared/openapi; bookings có holds/orders/allocation/inventory/waiting-room/shared/openapi. Catalog/module nhỏ gom HTTP/schema/service/repository/OpenAPI theo tầng; events/age và tickets/attendees gom theo chức năng. Cây folder tại Docs/31.

Validation dùng Zod tại biên API; query catalog/phân trang được kiểm tra chặt, ID nằm trong BIGINT, version trong INTEGER. Mutation có body cần application/json; sai Content-Type trả 415. `npm run check` kiểm tra secret/lint/TypeScript/test/build/format; test hiện tại dùng fixture, không đọc `.env` thật hoặc gửi email.

ADR-023: hồ sơ có gender/DOB private; API follow/inbox, event minimumAge/ageTag, attendee mỗi vé và staff đối chiếu CCCD đã có. Gói Compose/`npm start` chạy sẵn notifications worker; khi chỉ chạy API dev thì dùng `npm run worker:notifications` riêng để phát notification/purge CCCD. Khởi động lại BE sau migration/cấu hình key. Chi tiết và giới hạn tại Docs/29 (`../Docs/29-profile-follow-age-attendees.md`, local).

Hồ sơ cá nhân đã có `GET/PATCH /api/v1/users/me`: đọc tên/avatar và sửa tên hiển thị của chính User theo quyền DB. Xem [module users](src/modules/users/README.md); FE sửa tên chưa nối.

Upload ảnh dùng Cloudflare R2: `POST /api/v1/media/uploads` cấp presigned PUT 5 phút, client upload trực tiếp rồi gọi `/media/uploads/complete` để BE xác minh và lưu URL. Avatar/event/merchandise tuân thủ quyền DB và ownership; xem cấu hình, migration và CORS (`../Docs/28-r2-image-upload.md`, local).

Express + TypeScript + PostgreSQL qua `pg`, modular monolith. Preference Customer ẩn/bỏ ẩn Organizer thử Prisma7.10.0, dùng cùng pool và guard/ORM trong một transaction; hold/payment/refund giữ pg. `npm ci` sinh client; SQL migration vẫn quản lý DDL, không chạy Prisma Migrate/db push trên projection. Phạm vi và đánh giá (`../Docs/45-prisma-pilot-rbac.md`, local). Cấu hình riêng ở `.env`; mẫu an toàn ở `.env.example`. Không commit `.env`.

Giai đoạn phát triển dùng một API instance, không load balancer. `compose.yml` đóng gói ứng dụng và hai dịch vụ đã được duyệt theo ADR-042; `compose.redis.yml`/`compose.search.yml` giữ profile hạ tầng riêng cho người phát triển muốn dùng `npm run dev` với hot reload. Code booking/hold/phòng chờ được kiểm tra trong phạm vi Docs/31 (`../Docs/31-backend-code-structure.md`, local); payOS/phát vé/check-in/admission đã nối FE và qua kiểm thử provider giả; giao dịch chuyển tiền thật chưa thử. Xem Docs/32 (`../Docs/32-payos-booking-ticket-flow.md`, local).

Chạy ngay trong **BE/** bằng `npm run dev`, mặc định cổng **3000**; FE ở terminal riêng, cổng **5173**. Trên Windows dùng runtime nvm chung:

```powershell
# Dùng Node 24 / npm 11 đã có trong PATH
npm.cmd run dev
```

Tạo schema/seed bằng DBeaver theo [database README](../database/README.md), sau đó chạy `npm run db:check` trong BE để kiểm tra kết nối và schema nghiệp vụ bằng truy vấn chỉ đọc. Schema hiện hành có51 bảng và mốc migration017. Dependency và lockfile nằm ngay trong `BE/`; không chạy npm từ gốc repository. `.env` được tìm theo đường dẫn module nên không phụ thuộc thư mục gọi lệnh. Hướng dẫn đầy đủ: môi trường local (`../Docs/24-local-development.md`, local).

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

Catalog chỉ trả event `PUBLISHED` và hồ sơ thay đổi đã duyệt. ID/tiền là chuỗi. Cấu hình auth ở [module auth](src/modules/auth/README.md), [hold/booking](src/modules/bookings/README.md), [payOS](src/modules/payments/README.md) và API Organizer/Admin (`../Docs/34-organizer-event-api.md`, local). `src/shared/database/transaction.ts` cung cấp một connection cho toàn transaction, không gọi mạng trong transaction. `npm run dev` chạy riêng API; launcher `start:monolith` chạy API cùng hai worker. Migration áp dụng có kiểm soát, không tự chạy lúc startup.

Runtime Windows dùng chung Node 24.21.0 tại `D:\NVM\installs` (npm 11.19.0). Helper `. .\scripts\use-node.ps1` và các lệnh setup/search/HTTPS/restore trong `scripts/` chỉ có ở bản local của chủ dự án. Clone GitHub cần Node/npm trong PATH và tự cấu hình `.env` theo `.env.example`; không dùng các lệnh helper khi chưa có thư mục local. CI dùng `npm run check:ci` và `check-secrets.mjs` ở gốc BE. Xem Docs/24-local-development.md.

Onboarding và Organizer cá nhân theo Docs/33 (`../Docs/33-registration-onboarding.md`, local) và Docs/34 (`../Docs/34-organizer-event-api.md`, local). `npm run test:commerce` chạy fresh/upgrade và integration trên PG tạm; đặt COMMERCE_TEST_BROWSER=1 sau FE build để kiểm chứng onboarding→purchase bằng Edge. Không gọi payOS/SMTP thật trong tests. Cách nâng từng phiên bản DB và trạng thái apply đã ghi tại database/README và Docs/26; không chạy lại migration đã có.

Refund/report/feedback APIs theo Docs37 (`../Docs/37-refunds-reviews-app-feedback.md`, local): hoàn thủ công có chứng từ, tổ chức duyệt/Admin theo report; đánh giá tổ chức và góp ý app riêng tư. FE chức năng mới chưa nối; không tự chuyển tiền hoặc cấp Admin thật.

## Home event search

Elasticsearch một instance đã được chấp thuận ADR-036; English/fuzzy/N-gram/prefix/completion, Redis candidates15s và PostgreSQL hydrate dữ liệu hiện hành. npm run search:setup → infra:search → apply015 khi cần → search:reindex; notifications worker hiện có đồng bộ outbox. DB local đã apply015, không chạy lại. npm run test:search chạy PG + ES thật trong fixture riêng và dọn index/API key. Setup/hợp đồng/consistency/limits (`../Docs/41-home-event-search.md`, local).

## Indoor/outdoor

NUMBERED indoor/QUANTITY outdoor theo khu đã có BE. POST Organizer zone-layouts và PUT zone-prices, GET public zones/POST zones/hold, cùng checkout/payment/tickets/attendees/refund/cancel. Không ghế vật lý giả, giữ6 vé/hold5 phút. Migration016 dùng lại47 bảng. Health Admin/API dùng chung readiness có Elasticsearch. Docs42 (`../Docs/42-outdoor-zone-ticketing.md`, local).
