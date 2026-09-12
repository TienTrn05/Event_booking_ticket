# Event Ticketing Platform

Dự án cá nhân xây dựng nền tảng đặt vé sự kiện, hướng đến tính đúng đắn, bảo mật và khả năng vận hành thực tế.

**Trạng thái:** đặc tả và thiết kế kỹ thuật trước triển khai ứng dụng. Đã có sơ đồ SVG/Mermaid, schema SQL và kiểm tra schema trên MySQL tạm; chưa có backend/frontend hoặc database production. Các đề xuất nghiệp vụ chưa được duyệt được đánh dấu `DECISION REQUIRED`.

Stack đã xác định: React + TypeScript + Vite; Node.js + Express + TypeScript; MySQL; REST API; JWT; Modular Monolith.

## Bắt đầu đọc

**Xem nhanh:** [Bộ 18 sơ đồ mở offline](docs/diagrams/index.html) · [Schema MySQL](database/schema.sql) · [Hướng dẫn SQL và kiểm thử](database/README.md).

1. [Quy tắc dự án](PROJECT_RULES.md).
2. [Tổng quan](docs/01-project-overview.md) và [yêu cầu](docs/02-requirements.md).
3. [Nghiệp vụ](docs/07-business-rules.md), [dữ liệu](docs/08-database-design.md), [đặt vé đồng thời](docs/11-booking-concurrency.md).
4. [Quyết định còn mở](docs/18-open-questions.md) trước khi triển khai phần liên quan.

## Bộ tài liệu

| File | Nội dung |
| --- | --- |
| [01](docs/01-project-overview.md) | Mục tiêu, phạm vi, thuật ngữ |
| [02](docs/02-requirements.md) | Yêu cầu chức năng, phi chức năng, tìm kiếm, thông báo, AI |
| [03](docs/03-user-roles-permissions.md) | Vai trò và ma trận quyền |
| [04](docs/04-authentication-authorization.md) | Xác thực, phiên, phân quyền |
| [05](docs/05-user-flows.md) | Luồng người dùng và tình huống lỗi |
| [06](docs/06-use-cases.md) | Danh mục và đặc tả use case |
| [07](docs/07-business-rules.md) | Quy tắc nghiệp vụ và vòng đời |
| [08](docs/08-database-design.md) | Thực thể, quan hệ, ràng buộc, chỉ mục |
| [09](docs/09-api-design.md) | REST API, hợp đồng dữ liệu, lỗi |
| [10](docs/10-backend-architecture.md) | Kiến trúc và trách nhiệm các tầng |
| [11](docs/11-booking-concurrency.md) | Transaction, khóa ghế, hết hạn, callback |
| [12](docs/12-security.md) | Bảo mật, logging, auditing |
| [13](docs/13-testing-strategy.md) | Chiến lược kiểm thử và nghiệm thu |
| [14](docs/14-environment-deployment.md) | Môi trường, biến cấu hình, vận hành |
| [15](docs/15-development-rules.md) | Git, code, quy trình thay đổi |
| [16](docs/16-roadmap.md) | Lộ trình và điều kiện hoàn thành |
| [17](docs/17-architecture-decisions.md) | ADR và đánh đổi |
| [18](docs/18-open-questions.md) | Quyết định cần xác nhận |
| [19](docs/19-system-diagrams.md) | Bộ sơ đồ kiến trúc, ERD, sequence, state và cách xuất lại |
| [20](docs/20-physical-sql-design.md) | Thiết kế SQL vật lý và ranh giới bảo vệ của DB |
| [21](docs/21-sql-transactions.md) | Mẫu SQL và ranh giới transaction cho service |

Tài liệu tiếng Việt; tên kỹ thuật, API và mã trạng thái giữ bằng tiếng Anh để sử dụng nhất quán trong triển khai. Schema có thể nạp vào database thử rỗng theo hướng dẫn; các ví dụ API/transaction vẫn là thiết kế, chưa phải ứng dụng có thể chạy.
