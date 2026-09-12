# 19. Bộ sơ đồ hệ thống

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

Sửa `.mmd` cho luồng/kiến trúc; với ERD, sửa SQL rồi chạy generator. Bộ công cụ chỉ dùng để soạn tài liệu, không chọn package manager hoặc dependency cho ứng dụng tương lai.

```powershell
python tools/diagrams/generate_erd.py
$env:PUPPETEER_SKIP_DOWNLOAD = 'true'
npm ci --prefix tools/diagrams
$env:DIAGRAM_BROWSER_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run build --prefix tools/diagrams
```

Thay đường dẫn browser nếu máy khác. Mermaid CLI và lockfile được pin trong tools/diagrams; SVG, gallery và README ảnh là output được commit để người đọc không phải cài công cụ. Nguồn chuẩn là `.mmd` và SQL; không sửa SVG thủ công.

Cú pháp ERD dựa trên [Mermaid Entity Relationship Diagrams](https://mermaid.js.org/syntax/entityRelationshipDiagram.html). Các nhãn Việt và các bước nghiệp vụ là thiết kế của dự án, không phải nội dung quy phạm từ thư viện.
