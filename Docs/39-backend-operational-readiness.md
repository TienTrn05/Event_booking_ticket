# 39. Bốn bước chuẩn bị vận hành BE — 2026-10-12

**Cập nhật 2026-10-14:** chức năng mới tại Docs40/migration014 tăng schema fresh lên47 bảng; readiness yêu cầu organization_blocks. Các số liệu46 bảng/90 test/restore dưới đây là bằng chứng lịch sử của lượt2026-10-12, không phải kết quả chạy lại trên schema mới.

Chủ dự án yêu cầu hoàn thiện CI PostgreSQL, readiness/giám sát worker, diễn tập restore và HTTPS trước khi bàn giao diện FE. Do chưa có domain/server, chủ dự án chọn **chuẩn bị và kiểm thử HTTPS local**. Vẫn Modular Monolith: một API instance, hai worker đã có trong cùng codebase, PostgreSQL/Redis/R2 trong phạm vi được duyệt. Không thêm bảng hoặc migration trong lượt này.

| Bước | Kết quả kiểm chứng | Giới hạn |
| --- | --- | --- |
| CI PostgreSQL | Workflow có job postgres-integration dùng PostgreSQL18; fresh schema, populated upgrades007–013, seed lặp, transaction/HTTP/TLS/worker tests | Đã kiểm chứng cùng chế độ service bằng PostgreSQL tạm có SCRAM; chưa push/chạy GitHub Actions từ lượt này |
| Readiness/worker | 46 bảng và các cột mốc migration; Redis khi cấu hình; heartbeat/PID/stale/job failure; supervisor restart bounded | Cùng máy, một API; không hỗ trợ health files/worker trên host khác |
| Backup/restore | Restore thực vào cluster tạm:46 bảng/323 hàng, metadata/fingerprint khớp, probe khóa thành công | Dữ liệu local hiện có; không đại diện RTO cho DB lớn hoặc backup R2/Redis/secret store |
| HTTPS local | Chứng chỉ localhost, Node client xác minh CA/SAN; wrong hostname bị từ chối; refresh/Origin/CSRF/cookie Secure theo fixture staging | Chưa có public staging/domain; OS trust store và cấu hình Google/SMTP/payOS thật không đổi |

## 1. CI PostgreSQL

[Workflow](../.github/workflows/ci.yml) giữ quality job và thêm postgres-integration, timeout15 phút. PostgreSQL service dùng tài khoản/mật khẩu **fixture**, không dùng `.env`, provider keys hoặc DB thật. Service container chỉ chạy trong CI. Quy trình tham chiếu [GitHub Docs](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).

`npm.cmd run test:commerce` build BE rồi chạy harness. Local mặc định dựng/dọn cluster riêng như trước; CI dùng `PG_COMMERCE_EXTERNAL=1` và service loopback. Script kiểm tra identity validation_fixture, chỉ tạo hai DB fixture và chỉ DROP những DB chính lượt chạy đã tạo. Không dùng server binaries Windows trong nhánh CI. Fixtures xóa provider/TLS/runtime secrets khỏi môi trường trước khi khởi tạo app.

Đã kiểm chứng nhánh external trên PostgreSQL18 tạm có SCRAM/password, toàn bộ test qua và DB được dọn. Job GitHub thực sẽ chạy khi commit được push/PR; đây không phải báo cáo một workflow remote đã xanh.

## 2. Readiness và giám sát worker

GET `/api/v1/health/live` chỉ kiểm tra API process. GET `/api/v1/health/ready` kiểm tra schema nghiệp vụ và runtime; lỗi trả503 SERVICE_UNAVAILABLE, không schema/credential/error nội bộ.

- Schema:46 bảng cần thiết, mốc onboarding/questionnaire/pricing/refund/feedback/attendee/ticket/cancellation; cột payment khi payOS được cấu hình. Không dựa vào việc SELECT1 thành công để coi toàn bộ app sẵn sàng.
- Redis: PING khi REDIS_URL có cấu hình. Commerce đã bật hoặc production thiếu Redis thì chưa ready. Không gọi SMTP/payOS/R2 trong mỗi probe.
- Workers: mặc định yêu cầu trong staging/production; API dev đứng riêng có thể chạy khi worker chưa bật. READINESS_REQUIRE_WORKERS cho phép cấu hình tường minh; launcher monolith mặc định bật yêu cầu này.

Heartbeat files tại `BE/.local/worker-health/`, atomic write/rename. API và worker dùng cùng đường dẫn/cùng máy. Kiểm tra PID còn sống, timestamp, trạng thái stopped, job vượt thời gian và3 lỗi liên tiếp cùng job. Job khác thành công không xóa bộ đếm lỗi của job đang hỏng. File chỉ chứa metadata vận hành, không payload/credential/PII.

| Biến tùy chọn | Mặc định/ý nghĩa |
| --- | --- |
| READINESS_REQUIRE_WORKERS | Tự bật staging/production, tắt standalone development |
| WORKER_STALE_SECONDS | 60; heartbeat quá cũ làm unready |
| WORKER_JOB_TIMEOUT_SECONDS | 120; phát hiện job treo, không dùng để tự hủy transaction |
| WORKER_HEALTH_DIRECTORY | `.local/worker-health` trong BE; cùng đường dẫn cho API/workers |

GET `/api/v1/admin/operations/health` cần statistics.read_system. Trả ready, worker status và số outbox pending/failed/oldest, payment pending/reconciliation; không nội dung đơn/khách hoặc khóa. Chưa cấp thêm Admin thật; kiểm thử Admin bằng fixture trên DB tạm. Public readiness không trả các thông tin này.

Chạy cả API và worker bằng một launcher local:

```powershell
cd BE
npm.cmd run build
npm.cmd run start:monolith
```

Launcher chạy một API, bookings worker và notifications worker. Process chết được khởi động lại sau1 giây; sau5 lần thoát trong60 giây dừng nhóm với exit1 để tránh vòng lặp. Shutdown qua IPC của đúng child rồi timeout10 giây; chỉ dừng process do launcher tạo. SUPERVISED_PROCESS là flag nội bộ do launcher cấp, không cấu hình thủ công trong `.env`. Worker ghi stopped và đóng DB/Redis; API graceful shutdown giữ hành vi đã có.

Không chạy launcher cùng một API dev khác. `npm.cmd run dev` và các worker riêng vẫn dùng được như trước. Với dịch vụ chạy lâu, operator theo dõi503/private health/log codes; worker treo hoặc liên tục lỗi cần sửa nguyên nhân và khởi động lại. Chưa có tích hợp gửi cảnh báo email/Slack hoặc deployment service của hệ điều hành.

Đã kiểm thử: worker chết → readiness503 → supervisor khởi động lại →200; không khởi động API thứ hai. Supervisor có kiểm thử budget/crash/IPC shutdown; malformed/stale/stopped/stuck/failing heartbeat đều bị đánh dấu unhealthy.

## 3. Diễn tập backup/restore

```powershell
cd BE
npm.cmd run db:restore-drill
```

Script dùng `.env` chỉ để đọc DB nguồn. Transaction REPEATABLE READ READ ONLY export snapshot; pg_dump và fingerprint cùng snapshot. Tạo backup custom ngoài Git, kiểm tra pg_restore --list rồi khôi phục vào cluster khác trên port ngẫu nhiên, không vào DB nguồn. Source/target dùng UTC cho fingerprint.

Đối chiếu tất cả hàng của từng bảng bằng fingerprint/count, metadata cột, constraint validation; probe mã vé và HMAC CCCD với khóa hiện có và dữ liệu tổng hợp trên DB khôi phục. Không log dữ liệu hàng/credential/token/CCCD hoặc lưu master key vào dump. Không tạo order/payment/send OTP trên DB nguồn.

Kết quả cuối local:

- Backup `backups/restore-drill-1791819341242.dump`,254724 bytes.
- Restore46 bảng,323 hàng, metadata và data khớp; keysProbe=true.
- Khoảng5 giây trên bộ dữ liệu local này; sourceReadOnly=true.
- Cluster/process/dữ liệu tạm đã được dọn; giữ backup đã kiểm chứng ngoài Git.

Backup DB chưa chứa file `.env`, khóa mã hóa, credential provider, PostgreSQL global roles/ACL hoặc R2 objects. Restore drill dùng no-owner/no-privileges vào role fixture; triển khai thật cần danh tính/ACL và secret được cấp riêng. Probe hiện dùng khóa đang có, chưa diễn tập lấy khóa từ một kho secret độc lập; hiện DB chưa có payment/ticket thật để kiểm chứng giải mã lịch sử thật.

Phục hồi vận hành: tạo DB riêng từ backup → cấp role/secret tương ứng → đối chiếu metadata/data → chạy đúng release và readiness → kiểm tra API → chuyển cấu hình có kiểm soát. Giữ DB nguồn để đối chiếu; không xóa lịch sử mới hoặc ghi đè DB đang phục vụ khách để rollback.

## 4. HTTPS local

```powershell
cd BE
npm.cmd run https:setup
npm.cmd run dev:https
```

URL cố định `https://localhost:3443` hoặc `https://127.0.0.1:3443`; Swagger `/api/docs/`. Setup tạo cert/key trong BE/.local/https, SAN localhost/127.0.0.1, thời hạn365 ngày, chỉ serverAuth và CA:FALSE. Chạy setup lại giữ key đã có. Không cài CA/trust vào OS hoặc đổi `.env`/redirect Google. OPENSSL_BIN có thể trỏ OpenSSL trên máy.

Chứng chỉ tự ký local cần trust tường minh ở client; browser có thể báo chưa tin cậy cho đến khi developer cấu hình trust. Các kiểm thử dùng certificate này làm CA tường minh với rejectUnauthorized=true, không ignore certificate errors. HTTPS_CERT_FILE/HTTPS_KEY_FILE phải đi thành cặp và chỉ dùng development/testing; không dùng profile chứng chỉ local này để deploy production.

Auth vẫn theo PUBLIC_APP_URL/Origin và APP_ENV đã chốt. `dev:https` chỉ đổi transport/port của API, không tự đổi origin FE, redirect provider hoặc chính sách cookie. Trước khi kiểm thử browser mutation cần cấu hình Origin/redirect phù hợp môi trường; không nới Origin để bỏ lỗi. Fixture HTTPS dùng APP_ENV=staging/PUBLIC_APP_URL=https để kiểm chứng cookie Secure theo chính sách hiện có, không thay cookie/lifetime/CSRF thật.

Đã kiểm chứng TLS đúng certificate/SAN; sai hostname bị từ chối; thiếu pricing migration trả503 trong khi live200; refresh qua TLS có Secure/HttpOnly/SameSite=Lax; Origin lạ/CSRF sai bị403; monitoring endpoint401/403 và Admin fixture200. Chưa kiểm thử Google/SMTP/payOS/R2 thật qua public HTTPS mới. Frontend chưa sửa vì chủ dự án muốn họp giao diện trước.

## Kết quả bàn giao

BE check90 unit/HTTP/config/architecture/lint/typecheck/build/format/secret guard qua; PostgreSQL43 passed/1 browser skipped trong lượt cuối, gồm HTTPS và supervised monolith. Nhánh service/SCRAM tương đương CI đã qua riêng trước lượt cuối bổ sung authorization assertion. Backup/restore đã chạy thật trên dữ liệu local. Không thêm bảng/role grants hoặc sửa auth/provider/FE; không chuyển tiền thật, không đo tải10.000 người và chưa chạy CI remote/public staging.

## Đồng bộ search readiness — 2026-10-14

checkRuntimeReadiness nay kiểm tra Elasticsearch nếu cấu hình, cùng Redis/worker. API health/ready và Admin operations health dùng cùng probe, không còn Admin ready=true chỉ vì bỏ qua ES. Permission/no-store/DTO giữ nguyên; unit probe ES offline/healthy đã kiểm tra. Không thêm dịch vụ hoặc cảnh báo ngoài hệ thống.
