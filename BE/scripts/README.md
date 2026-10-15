# Script phát triển Backend

Thư mục này chứa script hỗ trợ của BE. Cấu hình ESLint, Vitest, TypeScript và .node-version nằm ở gốc BE; Frontend giữ tooling riêng trong Fe/.

| File                               | Mục đích                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `use-node.ps1`                     | Đọc `BE/.node-version`, dùng Node chung tại `D:\NVM\installs`, chỉ đổi PATH phiên hiện tại |
| `setup-env.mjs`, `protect-env.ps1` | Tạo `BE/.env` khi thiếu và bảo vệ quyền truy cập                                           |
| `check-secrets.mjs`                | Kiểm tra bí mật trong Git index và file nguồn, không in giá trị bí mật                     |
| `setup-search.mjs`                 | Chuẩn bị cấu hình Elasticsearch local ngoài Git, giữ giá trị đã có                         |
| `setup-https.mjs`, `dev-https.mjs` | Tạo/dùng chứng chỉ HTTPS local, không cài trust vào OS                                     |
| `start-monolith.mjs`               | Supervisor một API và hai worker cùng máy, giới hạn restart                                |
| `test-commerce.mjs`                | PostgreSQL fixture fresh/upgrade/seed và integration, tự dọn tài nguyên của lượt chạy      |
| `test-search.mjs`                  | Index/API key fixture riêng trên Elasticsearch local, giữ nguyên index ứng dụng            |
| `restore-drill.mjs`                | Backup nguồn chỉ đọc, restore vào cluster tạm và đối chiếu dữ liệu/metadata                |

Chạy các lệnh npm ngay tại **BE/**. Dependency và cấu hình Prettier nằm trong `BE/package.json`.

`npm ci` sinh Prisma Client cho preference ẩn Organizer; chạy `npm run prisma:generate` sau khi sửa model, `npm run prisma:validate` kiểm tra projection không cần DB. SQL vẫn quản lý DDL, không chạy db push/Migrate trên projection giới hạn. [Docs45](../../Docs/45-prisma-pilot-rbac.md).

Đây là công cụ chính thức của sản phẩm/CI, không phải script tạm để dọn bỏ. Hướng dẫn sử dụng và giới hạn tại [Docs39](../../Docs/39-backend-operational-readiness.md), [Docs41](../../Docs/41-home-event-search.md) và [Docs43](../../Docs/43-backend-v1.md).
