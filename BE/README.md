# Backend

Express + TypeScript + PostgreSQL qua `pg`, modular monolith. Cấu hình riêng ở `.env`; mẫu an toàn ở `.env.example`. Không commit `.env`.

Chạy ngay trong **BE/** bằng `npm run dev`, mặc định cổng **3000**; FE ở terminal riêng, cổng **5173**. Trên Windows dùng runtime riêng:

```powershell
. .\tooling\use-node.ps1
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

Catalog chỉ trả event `PUBLISHED` và hồ sơ mở bán lại `APPROVED`. ID và tiền được serialize thành chuỗi. Auth, booking, payment và mutation Organizer vẫn theo hợp đồng trong Docs/09, chưa được giả lập bằng endpoint thiếu xác thực. `src/shared/database/transaction.ts` cung cấp một connection cho toàn transaction; không gọi mạng trong transaction. Worker/migration tự động chưa bật.
