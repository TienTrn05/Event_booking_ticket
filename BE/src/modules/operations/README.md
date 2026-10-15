# Operations monitoring

GET /admin/operations/health dùng permission statistics.read_system, no-store, chỉ trả trạng thái worker/readiness và backlog counts. SQL trong OperationsRepository; không credential/PII hoặc mutation.

Readiness và heartbeat/supervisor ở shared/workers, một API/hai worker cùng máy; không distributed locks/instances hoặc message broker. Hướng dẫn và kiểm chứng tại [Docs39](../../../../Docs/39-backend-operational-readiness.md).
