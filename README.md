# Event Ticketing Platform

Dự án cá nhân xây dựng nền tảng đặt vé sự kiện, hướng đến tính đúng đắn, bảo mật và khả năng vận hành thực tế.

**Trạng thái:** đã có đặc tả, SQL 38 bảng, 19 sơ đồ và khung BE/FE chạy được. Cấu trúc chính: `BE/`, `Fe/`, `Docs/`, `database/`. Đã cấu hình môi trường riêng, chất lượng code và 7 test nền tảng; các tính năng đăng nhập/đặt vé/editor/duyệt sự kiện chưa triển khai. Kết quả 67 kiểm tra schema lịch sử xem database/README.md; cấu hình production và nghiệp vụ còn mở xem Docs/18.

## Chạy dự án trên Windows

```powershell
. .\BE\tooling\use-node.ps1
npm.cmd run dev
```

FE: http://127.0.0.1:5173 · BE: http://127.0.0.1:3000. Node và dependencies đã cài riêng cho dự án. [Hướng dẫn setup, cấu trúc và bảo vệ .env](Docs/24-local-development.md). Không commit `BE/.env`; `Fe/.env` chỉ chứa cấu hình công khai.

Kiểm tra: `npm.cmd run check`; kết nối MySQL chỉ đọc: `npm.cmd run db:check`. Máy mới chạy `npm.cmd ci` và `npm.cmd run setup:env` rồi điền thông tin DB riêng.

Stack đã xác định: React + TypeScript + Vite; Node.js + Express + TypeScript; MySQL; REST API; JWT; Modular Monolith.

## Bắt đầu đọc

**Xem nhanh:** [Bộ 19 sơ đồ mở offline](Docs/diagrams/index.html) · [Schema MySQL](database/schema.sql) · [Hướng dẫn SQL và kiểm thử](database/README.md).

1. [Quy tắc dự án](PROJECT_RULES.md).
2. [Tổng quan](Docs/01-project-overview.md) và [yêu cầu](Docs/02-requirements.md).
3. [Nghiệp vụ](Docs/07-business-rules.md), [dữ liệu](Docs/08-database-design.md), [đặt vé đồng thời](Docs/11-booking-concurrency.md).
4. [Nghiệp vụ mới và editor](Docs/23-organization-review-seatmap.md), [quyết định đã chốt/phần còn mở](Docs/18-open-questions.md) trước khi triển khai phần liên quan.

## Bộ tài liệu

| File | Nội dung |
| --- | --- |
| [01](Docs/01-project-overview.md) | Mục tiêu, phạm vi, thuật ngữ |
| [02](Docs/02-requirements.md) | Yêu cầu chức năng, phi chức năng, tìm kiếm, thông báo, AI |
| [03](Docs/03-user-roles-permissions.md) | Vai trò và ma trận quyền |
| [04](Docs/04-authentication-authorization.md) | Xác thực, phiên, phân quyền |
| [05](Docs/05-user-flows.md) | Luồng người dùng và tình huống lỗi |
| [06](Docs/06-use-cases.md) | Danh mục và đặc tả use case |
| [07](Docs/07-business-rules.md) | Quy tắc nghiệp vụ và vòng đời |
| [08](Docs/08-database-design.md) | Thực thể, quan hệ, ràng buộc, chỉ mục |
| [09](Docs/09-api-design.md) | REST API, hợp đồng dữ liệu, lỗi |
| [10](Docs/10-backend-architecture.md) | Kiến trúc và trách nhiệm các tầng |
| [11](Docs/11-booking-concurrency.md) | Transaction, khóa ghế, hết hạn, callback |
| [12](Docs/12-security.md) | Bảo mật, logging, auditing |
| [13](Docs/13-testing-strategy.md) | Chiến lược kiểm thử và nghiệm thu |
| [14](Docs/14-environment-deployment.md) | Môi trường, biến cấu hình, vận hành |
| [15](Docs/15-development-rules.md) | Git, code, quy trình thay đổi |
| [16](Docs/16-roadmap.md) | Lộ trình và điều kiện hoàn thành |
| [17](Docs/17-architecture-decisions.md) | ADR và đánh đổi |
| [18](Docs/18-open-questions.md) | Quyết định cần xác nhận |
| [19](Docs/19-system-diagrams.md) | Bộ sơ đồ kiến trúc, ERD, sequence, state và cách xuất lại |
| [20](Docs/20-physical-sql-design.md) | Thiết kế SQL vật lý và ranh giới bảo vệ của DB |
| [21](Docs/21-sql-transactions.md) | Mẫu SQL và ranh giới transaction cho service |
| [22](Docs/22-frontend-architecture.md) | Frontend, editor layout, form duyệt/lý do, phục hồi hold, payment/check-in |
| [23](Docs/23-organization-review-seatmap.md) | Quyết định tổ chức, Admin review 15 ngày, Google/OTP, check-in và công cụ thiết kế ghế |

Tài liệu tiếng Việt; tên kỹ thuật, API và mã trạng thái giữ bằng tiếng Anh để sử dụng nhất quán trong triển khai. Schema có thể nạp vào database thử rỗng theo hướng dẫn; các ví dụ API/transaction vẫn là thiết kế, chưa phải ứng dụng có thể chạy.

Tài liệu bổ sung: [24 — Môi trường phát triển BE/FE](Docs/24-local-development.md).
