# Operations monitoring

GET /admin/operations/health dùng permission statistics.read_system, no-store, chỉ trả trạng thái worker/readiness và backlog counts. SQL trong OperationsRepository; không credential/PII hoặc mutation.

GET /admin/statistics cần ADMIN và statistics.read_system. Strict from/to ISO theo [from,to); tổng hợp entity theo created_at, vé/tiền theo booking.created_at. Không nhân tiền theo item/attempt, nhóm currency, tách gross/received/refunded/pending/net/reconciliation; response no-store và không PII. Controller xử lý HTTP, service kiểm tra quyền và transaction, repository giữ SQL. Hợp đồng tại [Docs43](../../../../Docs/43-backend-v1.md).

Readiness và heartbeat/supervisor ở shared/workers, một API/hai worker cùng máy; không distributed locks/instances hoặc message broker. Hướng dẫn và kiểm chứng tại [Docs39](../../../../Docs/39-backend-operational-readiness.md).

Admin statistics thêm merchandise.orders/money theo cohort order.created_at, tách khỏi vé; Organizer có merchandise-sales riêng. Không payout hoặc giả chuyển tiền. [Docs44](../../../../Docs/44-backend-v1-extensions.md).
