# Catalog

API đọc công khai phục vụ event/category, organizer, merchandise, article, location, venue và hồ sơ thay đổi đã duyệt. `catalog.routes.ts` khai báo đường dẫn; controller/schema xử lý HTTP và validation; service ghép dữ liệu Home và xử lý không tìm thấy.

Repository SQL chia theo events/organizers/content/venues. `catalog.repository.ts` ghép `postgresCatalogRepository` và giữ hợp đồng `CatalogRepository` để inject/test; không đổi public DTO. OpenAPI paths và response schemas thuộc module này.

Query có allowlist, chuỗi scalar và trần phân trang; featured/spotlight chỉ true/false. ID venue dùng BIGINT chuỗi từ shared; public ID giữ định dạng hiện hành. Xem [cấu trúc và validation](../../../../Docs/31-backend-code-structure.md).
