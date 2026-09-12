# 19. Bộ sơ đồ hệ thống

**Phiên bản baseline:** Mermaid/SVG/gallery xuất sẵn chưa bao phủ quyết định mới về Organization, review, layout, Google/OTP và CheckIn riêng. Xem [model hiện hành](23-organization-review-seatmap.md); cần đồng bộ DDL/ERD và xuất lại trước dùng các ảnh này làm thiết kế triển khai. Các chỉ dẫn dưới đây mô tả bộ baseline.

## Xem sơ đồ

**Mở [index.html](diagrams/index.html)** bằng trình duyệt để xem toàn bộ sơ đồ offline, chọn từng sơ đồ trong mục lục và mở SVG để phóng to/in. Không cần chạy server, CDN hoặc tải dữ liệu dự án lên dịch vụ ngoài. Cũng có thể xem [README có ảnh](diagrams/README.md) trong trình xem Markdown.

| Nhóm | Sơ đồ | Tài liệu liên quan |
| --- | --- | --- |
| Phạm vi và kiến trúc | 01 Context, 02 Components, 03 Deployment, 04 Use cases | 01, 03, 06, 10, 14; ADR-001/ADR-008 |
| Dữ liệu vật lý | 05 Identity, 06 Events, 07 Booking, 08 Operations | [schema.sql](../database/schema.sql), [20](20-physical-sql-design.md) |
| Trình tự giao dịch | 09 Booking, 10 Seat race, 11 Late payment | FR-013–FR-023, BR-001–BR-019; [11](11-booking-concurrency.md) |
| Bảo mật và tiền/vé | 12 Auth refresh, 13 Refund/check-in, 18 Authorization | FR-002/FR-015/FR-018/FR-020, [04](04-authentication-authorization.md) |
| Vòng đời | 14 Booking, 15 Payment/refund, 16 Ticket/seat/hold | [07](07-business-rules.md) |
| Phục hồi | 17 Outbox worker | NFR-002/NFR-011; ADR-006/ADR-011 |

Sơ đồ use case dùng flowchart với các oval biểu diễn use case; đây không phải tuyên bố UML đầy đủ. Context/components/deployment là các góc nhìn kiến trúc, không tự thêm service triển khai độc lập.

## Quy ước đọc

- Nét liền là quan hệ/luồng đang được thiết kế cho MVP; nét đứt trong context/deployment là tích hợp sau MVP hoặc còn quyết định.
- ERD dùng đúng tên bảng/cột snake_case trong SQL, chỉ hiển thị cột trọng yếu để đọc được. Danh sách cột đầy đủ ở schema, không sửa SQL dựa vào việc một cột không được vẽ.
- PK = khóa chính, FK = khóa ngoại; crow's foot là nhiều, vòng tròn là có thể không có. Một số bảng xuất hiện ở nhiều ERD vì là điểm nối giữa module.
- ERD chỉ vẽ FK vật lý. `aggregate_type/id`, `resource_type/id` ở outbox/audit/idempotency là tham chiếu đa hình do service quản lý, không giả vẽ thành FK DB.
- Unique trên generated guards không thể diễn đạt đầy đủ bằng cardinality; xem [20](20-physical-sql-design.md). State diagram thể hiện chuyển hợp lệ ở service; CHECK trong DDL không tự kiểm tra trạng thái trước đó.
- Chính sách gắn Q-xxx vẫn `DECISION REQUIRED`. Sơ đồ mô tả phương án review, không chứng minh đã có ứng dụng chạy.

## Chỉnh và xuất lại

Sửa nguồn `.mmd` rồi xuất SVG bằng trình hỗ trợ Mermaid khi cần. Với ERD, đối chiếu tên bảng, cột và quan hệ trong SQL; cập nhật nguồn sơ đồ cùng thay đổi schema. SVG, gallery và README ảnh là sản phẩm bàn giao có thể mở ngay, không cần cài công cụ.

Các script sinh/xuất sơ đồ và dependency phụ trợ đã được dọn theo yêu cầu, repo không có build command riêng. Khi thay sơ đồ, xuất lại SVG cùng tên và cập nhật mục lục gallery/README nếu thêm hoặc bỏ sơ đồ; không sửa SVG thủ công.

Cú pháp ERD dựa trên [Mermaid Entity Relationship Diagrams](https://mermaid.js.org/syntax/entityRelationshipDiagram.html). Các nhãn Việt và các bước nghiệp vụ là thiết kế của dự án, không phải nội dung quy phạm từ thư viện.
