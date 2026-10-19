# audit

GET /admin/audit-logs đã triển khai: audit.read và scope duyệt/report, phân trang/lọc thời gian/resource/action. Chỉ metadata actor/action/resource/request/time; không reason/raw before-after/credential/PII. Service kiểm tra quyền, repository giữ SQL. Xem Docs/40.
