# Backend

Express + TypeScript + mysql2, modular monolith. Cấu hình riêng ở `.env`; mẫu an toàn ở `.env.example`. Không commit `.env`.

Chạy từ gốc: `npm run dev:api`, `npm run db:check`. Hướng dẫn đầy đủ: [môi trường local](../Docs/24-local-development.md).

`src/app.ts` không tự mở cổng, nhận dependency để test; `src/server.ts` mở cổng và đóng pool. Module nghiệp vụ chưa có endpoint; controller/service/repository được bổ sung khi triển khai theo đặc tả. `src/shared/database/transaction.ts` cung cấp một connection cho toàn transaction; không gọi mạng trong transaction. Worker/migration tự động chưa bật.
