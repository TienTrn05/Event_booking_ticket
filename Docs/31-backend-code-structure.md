# 31. Cấu trúc mã Backend

Khởi đầu refactor2026-10-11, cập nhật cấu trúc2026-10-15. Giữ Modular Monolith/một API instance theo ADR-025; tổ chức code trong cùng ứng dụng, không mở rộng hạ tầng. Phần kiểm chứng refactor bên dưới là lịch sử; trạng thái hiện hành tại [43](43-backend-v1.md).

## Thư mục con trong module

Theo phản hồi tiếp theo của chủ dự án, file được gom vào thư mục con để tránh danh sách phẳng quá dài. Module lớn gom theo chức năng; phần HTTP/schema/repository/OpenAPI của module nhỏ gom theo tầng. Gốc module chỉ giữ README, routes hoặc entry point cần ghép các nhóm.

```text
modules/
  auth/
    auth.routes.ts, auth.service.ts, auth.repository.ts, README.md
    google/       controller, service, schema Google
    otp/          controller, service, repository, schema OTP
      email/      SMTP adapter và template
    session/      controller, service, repository phiên
    account/      metadata/linking và identity repository
    http/         controller ghép nhóm và cookie/CSRF
    shared/       config, crypto, kiểu dữ liệu và audit auth
    openapi/      contract auth
  bookings/
    booking.routes.ts, booking.service.ts, README.md
    holds/        controller, service, schema giữ ghế
    orders/       controller, command/query service, repository, schema đơn
    allocation/   khóa/cleanup/expiry và repository
    inventory/    controller, service, repository, schema snapshot
    waiting-room/ controller, service, repository, schema cache
    shared/       context/policy và types
    payments/, refunds/  adapter giữa booking với payment/refund
    openapi/      contract booking/phòng chờ
  catalog/
    catalog.routes.ts, catalog.service.ts, catalog.repository.ts, README.md
    http/, schemas/, types/, repositories/, openapi/
  events/
    age/          giới hạn/kiểm tra tuổi
    management/   draft, layout, session, giá, review và reason notice
    operations/   sửa nội dung đã công bố, hủy và hậu xử lý
  tickets/
    attendees/    người tham dự/giấy tờ
    issuance/, check-in/, application/, http/, repositories/
  users/, notifications/, media/
    http/, schemas/, services/, repositories/, openapi/
    media/storage/    adapter R2
  organizations/  application/, http/, repositories/
  payments/       application/, gateways/, http/, repositories/, refunds/
  audit/, feedback/, operations/, refunds/, sales/, search/, support-reports/
shared/
  idempotency/    claim/replay/finish key dùng chung
  workers/        runner, readiness, heartbeat và supervisor
```

Import source/test và tham chiếu tài liệu được cập nhật theo vị trí mới. Không giữ shim ở từng đường dẫn cũ làm danh sách phẳng dài trở lại; giữ entry point auth/booking/catalog khi có caller thực sự.

## Tìm đúng nơi để sửa

| Vị trí | Trách nhiệm |
| --- | --- |
| `BE/src/server.ts`, `startup/` | Mở API, lắp dependency và shutdown; `startup` thay `Bootstrap` cũ |
| `BE/src/app.ts` | Lắp middleware/module/error handler; không tự mở cổng |
| `BE/src/config/` | Đọc/validate cấu hình, không đưa bí mật vào lỗi |
| `BE/src/modules/**/*.routes.ts` | Method/path, thứ tự middleware auth/Origin/rate limit, gắn controller |
| `*.controller.ts` | Chuyển request sang actor/input đã validate, gọi service, dựng response/status/header |
| `*.schema.ts` | Zod cho body/query/params/cache; không gọi DB/provider |
| `*.service.ts` | Use case, quyền/nghiệp vụ, transaction và điều phối adapter/repository |
| `*.repository.ts` | SQL có tham số, nhận connection của transaction, không tự commit |
| `*.policy.ts` | Quy tắc nghiệp vụ thuần, không HTTP/SQL |
| `*.types.ts` | Kiểu dữ liệu/hợp đồng dependency |
| `*.openapi.ts`, `*.openapi.schemas.ts` | Contract từng module; `src/openapi.ts` chỉ ghép tài liệu chung |
| `BE/src/scripts/` | Entry point kiểm tra DB/worker, không phải module HTTP |
| `BE/scripts/` | Runtime, setup/protect env và kiểm tra secret |
| `BE/tests/` | Validation, HTTP, OpenAPI và dependency; fixture không đọc `.env` thật |
| `BE/node_modules/`, `BE/dist/` | Dependency/build output, không sửa code ứng dụng ở đây |

Luồng: routes → controller → schema/service → repository/adapter. Service truyền cùng connection xuống repository, không gọi mạng trong transaction. Không chia file theo số dòng cứng hoặc tạo class/interface chỉ để có hình thức OOP.

## Phần sử dụng chung và dependency

Pilot Prisma ADR-039: shared/database/prisma.ts quản lý ORM transaction trên pool hiện có; SqlReader cho guard đọc/khóa trên chính transaction đó. Chỉ users/blocks dùng ORM; không ép Prisma thành PoolClient hoặc dùng connection khác giữa use case. Client projection/đánh giá tại [Docs45](45-prisma-pilot-rbac.md).

- `shared/validation/common.schema.ts`: ID BIGINT dạng chuỗi, public ID, ngày lịch, version INTEGER, phân trang và body rỗng. Các module không lấy schema chung từ notifications nữa. ID sai bị chặn trước BigInt.
- `shared/validation/contact.schema.ts`: chuẩn hóa email/SĐT cho auth và attendee; validation attendee không kéo theo OTP/SMTP.
- `shared/validation/cached-json.ts`: cache sai JSON/schema trở thành cache miss, tải lại PostgreSQL.
- `shared/auth/request-actor.ts`: context phiên đã xác thực và actor theo request cho bookings/media; không lấy actor từ body.
- `shared/http/private-request.ts`, `response.ts`: Origin/envelope/no-store dùng chung. Cookie/CSRF vẫn thuộc auth.
- `shared/database/ids.ts`: so sánh ID không ép BIGINT sang Number; pool/transaction giữ rollback/release như trước.
- `shared/openapi/`: helper envelope/error/parameter và health; contract age/attendee không đặt ở notifications.
- `shared/workers/run-worker.ts`: vòng lặp/signal/đóng tài nguyên dùng chung. Job giữ transaction/nghiệp vụ riêng. Notification và retention vẫn ở worker hiện có; lỗi retention không ngăn notification chạy. Không thêm worker instance/broker.

Auth xác minh phiên; users repository recheck User/session/authVersion dưới khóa khi cần. Không gộp các query quyền/scope khác nhau chỉ vì cùng đọc một bảng: điều kiện và cách khóa khác nhau phải được bảo toàn.

## Module nhiều trách nhiệm

- **Auth:** Google/OTP/session/account có thư mục/service/controller riêng; cookie/CSRF ở `http/auth.http.ts`; config/crypto/types trong `shared/`. Repository tách identity/session/audit. `auth.service.ts` và `auth.repository.ts` là entry point ghép chức năng để caller giữ ổn định. Provider/linking/JWT/refresh/rotation/cookie/CSRF giữ nguyên.
- **Bookings:** hold, booking command/query, allocation expiry, inventory và waiting-room có thư mục riêng. SQL ở repository; public/sale policy ở `shared/booking.policy.ts`. Giữ thứ tự khóa/idempotency, admission ngoài transaction.
- **Catalog:** controller/schema riêng; repository tách events/organizers/content/venues. Facade tiếp tục đáp ứng `CatalogRepository` để inject vào app/service.
- **Events/age:** controller không có SQL/logic tuổi; service điều phối transaction/profile/tuổi, repository tải context và ghi/audit.
- **Users/notifications/tickets/media:** routes lắp middleware, controller chuyển input/output, schema/service/repository riêng. Media đọc avatar qua service.

Các module audit/organizations/payments/support-reports đã có code thực. Review/layout/session nằm trong events/management, public venue trong catalog/repositories; không giữ thư mục chỉ có README cho các miền này. Outbox do repository/job của module sở hữu xử lý, không có shared/outbox rỗng hoặc payments/adapters dự phòng.

## Validation được siết lại

- ID DB chuỗi số dương canonical ≤9223372036854775807; venue dùng cùng quy tắc.
- Query phân trang chỉ nhận chuỗi thập phân đơn: page 1–100000/pageSize 1–100; không ép array/object/boolean/dạng khoa học. Default catalog pageSize 24, inbox/booking 20 như trước.
- Catalog từ chối query ngoài allowlist; featured/spotlight chỉ true/false, không nhận query lặp. Google callback vẫn cho phép scope/authuser/prompt của provider, chỉ tiêu thụ code/state.
- Version 0–2147483647. Ngày lịch phải có thật; tương lai/tuổi tiếp tục kiểm tra trong service theo DB/ngày suất.
- Waiting-room join nhận object rỗng, không nhận cấu hình client. Mutation có body ở `/api/v1` cần application/json; sai Content-Type trả 415 `UNSUPPORTED_MEDIA_TYPE`, JSON hỏng trả 400 `INVALID_JSON`.
- Body mutation strict/allowlist; tiếp tục chống ghế/attendee trùng, số lượng 1–6, upload type/size và proof giấy tờ.

## Kiểm chứng

70 test chính thức đã qua sau khi gom folder, không gọi Google/SMTP/R2/Redis/DB thật: HTTP/schema, Origin/CSRF/response, tham chiếu source, runtime import cycle, SQL không ở routes/controller/service, OpenAPI/config và worker lifecycle. Lint/TypeScript/build/format/secret guard đều qua; build kiểm tra dùng thư mục tạm, không ghi đè dist sẵn có.

Đợt refactor đã chạy 25 kiểm tra PostgreSQL 18 riêng: phiên/JWT, refresh rotation/reuse/expiry tuyệt đối, tranh chấp ghế, idempotency/replay, ownership, tạo/đọc/hủy/hết hạn booking, hồ sơ/follow/catalog. Database/process/script/cluster tạm đã dọn. Không kiểm thử lại provider live hoặc payment/issuance/admission đầy đủ; flow chưa có không được ghi hoàn thành.

Bổ sung ADR-027: payment application/gateway/HTTP/repository; booking payment adapter; ticket issuance/check-in/application/HTTP/repository. Idempotency repository/schema chuyển vào shared/idempotency để các module dùng chung. Luồng và kiểm thử mới ở [32](32-payos-booking-ticket-flow.md); các giới hạn payment ghi phía trên thuộc thời điểm refactor trước đó.

## Module mở rộng v1

organizations/memberships giữ invite/accept/decline/revoke; reputation giữ đọc điểm và ledger/đảo; events/sales-changes giữ delta có duyệt; merchandise giữ product/SKU/order/fulfillment/payment/refund. modules/index.ts và OpenAPI mount đầy đủ. PurchasePaymentPort tách common purchase khỏi LockedPurchase vé; chỉ booking gọi TicketIssuer. SQL trong repository, expiry dùng bookings worker hiện có. [44](44-backend-v1-extensions.md).
