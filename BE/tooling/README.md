# Công cụ phát triển Backend

Thư mục này chỉ chứa cấu hình và script của `BE/`. Frontend có tooling, lockfile và node_modules riêng trong `Fe/`.

| File | Mục đích |
| --- | --- |
| `use-node.ps1`, `.node-version` | Dùng Node chung tại `D:\NVM\installs`, chỉ đổi PATH phiên hiện tại |
| `setup-env.mjs`, `protect-env.ps1` | Tạo `BE/.env` khi thiếu và bảo vệ quyền truy cập |
| `check-secrets.mjs` | Kiểm tra file chuẩn bị đưa vào Git, không in giá trị bí mật |
| `eslint.config.mjs` | Quy tắc lint Backend |
| `vitest.config.ts` | Kiểm thử trong `BE/tests` |
| `tsconfig.base.json` | TypeScript strict của Backend |

Chạy các lệnh npm ngay tại **BE/**. Prettier và dependency được cấu hình trong `BE/package.json`; không resolve package từ gốc hoặc từ `Fe/`.
