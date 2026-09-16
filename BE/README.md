# Backend

Express + TypeScript + mysql2, modular monolith. Cấu hình riêng ở `.env`; mẫu an toàn ở `.env.example`. Không commit `.env`.

Chạy ngay trong **BE/** bằng `npm run dev`, mặc định cổng **3000**; FE ở terminal riêng, cổng **5173**. Trên Windows dùng runtime riêng:

```powershell
. .\tooling\use-node.ps1
npm.cmd run dev
```

Trong BE, `npm run db:check` kiểm tra kết nối database. Có thể gọi thay từ gốc bằng `npm run dev:api`; không chạy thêm bản API thứ hai cùng cổng. `.env` được tìm theo đường dẫn module nên không phụ thuộc thư mục gọi lệnh. Hướng dẫn đầy đủ: [môi trường local](../Docs/24-local-development.md).

`src/app.ts` không tự mở cổng, nhận dependency để test; `src/server.ts` mở cổng và đóng pool. Module nghiệp vụ chưa có endpoint; controller/service/repository được bổ sung khi triển khai theo đặc tả. `src/shared/database/transaction.ts` cung cấp một connection cho toàn transaction; không gọi mạng trong transaction. Worker/migration tự động chưa bật.
