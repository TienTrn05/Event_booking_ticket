# Script phát triển Backend

Thư mục này chứa script hỗ trợ của BE. Cấu hình ESLint, Vitest, TypeScript và .node-version nằm ở gốc BE; Frontend giữ tooling riêng trong Fe/.

| File                               | Mục đích                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `use-node.ps1`                     | Đọc `BE/.node-version`, dùng Node chung tại `D:\NVM\installs`, chỉ đổi PATH phiên hiện tại |
| `setup-env.mjs`, `protect-env.ps1` | Tạo `BE/.env` khi thiếu và bảo vệ quyền truy cập                                           |
| `check-secrets.mjs`                | Kiểm tra bí mật trong Git index và file nguồn, không in giá trị bí mật                     |

Chạy các lệnh npm ngay tại **BE/**. Dependency và cấu hình Prettier nằm trong `BE/package.json`.
