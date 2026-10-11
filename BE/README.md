# Backend

Cấu trúc code, trách nhiệm từng folder/file và phần dùng chung tại [Docs/31](../Docs/31-backend-code-structure.md). Routes khai báo HTTP/middleware; controller xử lý input/output; service giữ use case/transaction; repository giữ SQL. Auth/booking/catalog và OpenAPI đã tách theo trách nhiệm. `src/startup/` thay `src/Bootstrap/`.

Module lớn gom vào thư mục con: auth có google/otp/session/account/http/shared/openapi; bookings có holds/orders/allocation/inventory/waiting-room/shared/openapi. Catalog/module nhỏ gom HTTP/schema/service/repository/OpenAPI theo tầng; events/age và tickets/attendees gom theo chức năng. Cây folder tại Docs/31.

Validation dùng Zod tại biên API; query catalog/phân trang được kiểm tra chặt, ID nằm trong BIGINT, version trong INTEGER. Mutation có body cần application/json; sai Content-Type trả 415. `npm run check` kiểm tra secret/lint/TypeScript/test/build/format; test hiện tại dùng fixture, không đọc `.env` thật hoặc gửi email.

ADR-023: hồ sơ có gender/DOB private; API follow/inbox, event minimumAge/ageTag, attendee mỗi vé và staff đối chiếu CCCD đã có. Chạy `npm run worker:notifications` trong terminal BE riêng để phát notification/purge CCCD; API không tự chạy worker. Khởi động lại BE sau migration/cấu hình key. Chi tiết và giới hạn tại [Docs/29](../Docs/29-profile-follow-age-attendees.md).

Hồ sơ cá nhân đã có `GET/PATCH /api/v1/users/me`: đọc tên/avatar và sửa tên hiển thị của chính User theo quyền DB. Xem [module users](src/modules/users/README.md); FE sửa tên chưa nối.

Upload ảnh dùng Cloudflare R2: `POST /api/v1/media/uploads` cấp presigned PUT 5 phút, client upload trực tiếp rồi gọi `/media/uploads/complete` để BE xác minh và lưu URL. Avatar/event/merchandise tuân thủ quyền DB và ownership; xem [cấu hình, migration và CORS](../Docs/28-r2-image-upload.md).

Express + TypeScript + PostgreSQL qua `pg`, modular monolith. Cấu hình riêng ở `.env`; mẫu an toàn ở `.env.example`. Không commit `.env`.

Giai đoạn phát triển dùng một API instance; chủ dự án đã yêu cầu bỏ load balancer để ưu tiên hoàn thiện sản phẩm. `compose.yml` chỉ còn Redis local cho phòng chờ/rate limit, có thể khởi động bằng `npm run infra:redis`; BE vẫn chạy bằng `npm run dev`. Không có Nginx, Dockerfile đóng gói API hoặc lệnh dev:scaled. Code booking/hold/phòng chờ hiện có được làm sạch và kiểm tra trong phạm vi [Docs/31](../Docs/31-backend-code-structure.md); payOS/phát vé/check-in/admission đã nối FE và qua kiểm thử provider giả; giao dịch chuyển tiền thật chưa thử. Xem [Docs/32](../Docs/32-payos-booking-ticket-flow.md).

Chạy ngay trong **BE/** bằng `npm run dev`, mặc định cổng **3000**; FE ở terminal riêng, cổng **5173**. Trên Windows dùng runtime nvm chung:

```powershell
. .\scripts\use-node.ps1
npm.cmd run dev
```

Tạo schema/seed bằng DBeaver theo [database README](../database/README.md), sau đó chạy `npm run db:check` trong BE để kiểm tra kết nối và sự hiện diện của 6 bảng catalog bằng truy vấn chỉ đọc. Dependency và lockfile nằm ngay trong `BE/`; không chạy npm từ gốc repository. `.env` được tìm theo đường dẫn module nên không phụ thuộc thư mục gọi lệnh. Hướng dẫn đầy đủ: [môi trường local](../Docs/24-local-development.md).

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

Catalog chỉ trả event `PUBLISHED` và hồ sơ mở bán lại `APPROVED`. ID/tiền là chuỗi. Google Authorization Code + PKCE, email OTP Customer, JWT và refresh cookie có endpoint; cấu hình/giới hạn ở [module auth](src/modules/auth/README.md). Hold/booking hiện có tại [module bookings](src/modules/bookings/README.md); payOS ở [module payments](src/modules/payments/README.md); mutation/onboarding Organizer đầy đủ vẫn theo contract đích Docs/09. `src/shared/database/transaction.ts` cung cấp một connection cho toàn transaction, không gọi mạng trong transaction. Worker/migration tự động chưa bật.

Runtime Windows dùng chung Node 24.21.0 tại `D:\NVM\installs` (npm 11.19.0). Chạy `. .\scripts\use-node.ps1` trước khi chạy npm.cmd; helper chỉ đổi PATH phiên hiện tại, không còn runtime riêng hoặc fallback `.local`. Xem Docs/24-local-development.md.
