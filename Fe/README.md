# Frontend

React + TypeScript + Vite. `src/app` điều phối router/providers; `src/features` chia theo nghiệp vụ; `src/shared` chứa HTTP client và thành phần dùng chung.

Chạy từ gốc: `npm run dev:web`. API cùng origin `/api/v1` qua proxy local. `.env` chỉ có cấu hình công khai; mọi biến VITE_ có thể xuất hiện trong bundle. Không đặt credentials DB, OTP hoặc khóa ký tại đây.

[Hướng dẫn local](../Docs/24-local-development.md) · [Kiến trúc FE](../Docs/22-frontend-architecture.md).
