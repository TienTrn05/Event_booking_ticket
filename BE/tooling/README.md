# Công cụ phát triển dùng chung

Thư mục này gom cấu hình và script của cả BE/Fe để giữ gốc dự án gọn. Không chứa nghiệp vụ backend hoặc bí mật.

| File | Mục đích |
| --- | --- |
| `use-node.ps1`, `.node-version` | Dùng Node riêng trong `BE/.local/` |
| `setup-env.mjs`, `protect-env.ps1` | Tạo env khi thiếu, giữ env đã có và bảo vệ quyền truy cập |
| `check-secrets.mjs` | Kiểm tra file chuẩn bị đưa vào Git, không in giá trị bí mật |
| `eslint.config.mjs` | Quy tắc lint cho hai app |
| `vitest.config.ts` | Kiểm thử từ gốc workspace |
| `tsconfig.base.json` | TypeScript strict dùng chung |

Chạy các lệnh npm tại **gốc dự án**. Prettier được cấu hình ngay trong `package.json` ở gốc; không còn file cấu hình riêng. `.github/workflows/` giữ ở vị trí GitHub yêu cầu; `.editorconfig` và `.npmrc` giữ ở gốc để công cụ tự nhận.
