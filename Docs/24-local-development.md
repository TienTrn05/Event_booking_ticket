# 24. Môi trường phát triển BE và FE

Đã dựng khung chạy thực tế theo yêu cầu chủ dự án: `BE/`, `Fe/`, `Docs/`, `database/`. `BE/` và `Fe/` là hai package npm độc lập; Node 24.21.0, npm 11.19.0, TypeScript strict, Express 5, React, Vite, pg, Zod, Pino, ESLint, Prettier và Vitest. Phiên bản dependency chính xác nằm trong package.json/lockfile của từng app.

Mỗi app tự giữ `node_modules`, lockfile, TypeScript, ESLint, Prettier, env setup và runtime helper trong `tooling/`. Gốc repository không có package.json, package-lock.json hoặc node_modules. FE không kế thừa config hay resolve dependency từ BE.

## Chạy trên máy hiện tại

Mở hai PowerShell tại gốc dự án:

```powershell
# Terminal Backend
cd BE
. .\tooling\use-node.ps1
npm.cmd run dev

# Terminal Frontend
cd Fe
. .\tooling\use-node.ps1
npm.cmd run dev
```

- FE: http://127.0.0.1:5173
- BE: http://127.0.0.1:3000
- Liveness: `/api/v1/health/live`.
- Readiness: `/api/v1/health/ready`, kiểm tra kết nối DB và sự hiện diện của 6 bảng catalog ADR-017 bằng truy vấn chỉ đọc.
- Swagger UI: `/api/docs/`; OpenAPI JSON: `/api/v1/openapi.json`.
- Ctrl+C dừng app trong terminal tương ứng. API đóng HTTP server và pool, có giới hạn chờ shutdown.

Node được cài riêng trong `BE/.local/...` hoặc `Fe/.local/...`, kiểm tra SHA256 theo bản phát hành chính thức. Mỗi script chỉ thêm PATH trong terminal hiện tại, không thay Node toàn máy. [Node releases](https://nodejs.org/en/about/previous-releases), [Vite runtime requirements](https://vite.dev/guide/).

## Máy mới

Backend:

```powershell
cd BE
. .\tooling\use-node.ps1
npm.cmd ci
npm.cmd run setup:env
# Điền kết nối PostgreSQL trong .env bằng editor riêng.
npm.cmd run db:check
npm.cmd run dev
```

Frontend, trong terminal khác:

```powershell
cd Fe
. .\tooling\use-node.ps1
npm.cmd ci
npm.cmd run setup:env
npm.cmd run dev
```

Linux/macOS dùng Node theo `tooling/.node-version` trong từng app, rồi chạy `npm ci` tại chính `BE/` và `Fe/`. `BE/setup:env` tạo key ngẫu nhiên dành cho auth/OTP/ticket trong tương lai; `Fe/setup:env` chỉ sao chép cấu hình Vite công khai và không ghi đè file đã có.

## Cấu trúc và trách nhiệm

```text
BE/
  src/
    app.ts                  # Express app factory, test không tự mở cổng
    server.ts               # Entry HTTP, signal và graceful shutdown
    config/                 # Đọc/validate biến môi trường phía server
    modules/                # auth, users, organizations, events, layouts...
    shared/
      database/             # pg pool, UTC và transaction cùng connection
      errors/               # AppError an toàn để trả client
      middleware/           # Error envelope; không trả raw SQL/stack trace
      logging/              # Structured log, field allowlist và redaction
      outbox/               # Chỗ triển khai worker nghiệp vụ sau này
    scripts/                # Kiểm tra kết nối DB chỉ đọc
  tests/                    # Test chính thức, integration/concurrency reserved
  node_modules/             # Chỉ dependency Backend, Git ignore
  package-lock.json         # Lockfile Backend
  migrations/               # Chưa có runner tự thay đổi schema
  .env                      # Riêng máy, bị Git bỏ qua
  .env.example              # Mẫu không chứa bí mật
Fe/
  node_modules/             # Chỉ dependency Frontend, Git ignore
  package-lock.json         # Lockfile Frontend
  tooling/                  # Node/env helper riêng của Frontend
  src/
    app/                    # Router root và providers
    features/               # auth, events, booking, tickets, organizer
      <feature>/            # pages, components, hooks, api, types
    shared/                 # HTTP client, UI, styles, hooks, utils, constants
  .env                      # Chỉ cấu hình công khai
  .env.example
AdminFe/                    # Đích frontend Admin độc lập; chưa scaffold
Docs/                       # Đặc tả, kiến trúc, hướng dẫn và sơ đồ
database/                   # DDL, seed, query hiện có
BE/tooling/                 # Cấu hình Backend, setup môi trường, secret guard
.github/workflows/ci.yml    # npm ci + check riêng trong BE và Fe
```

Module `catalog` đã có route → service → repository và đọc dữ liệu công khai từ PostgreSQL. Các module auth/booking/payment/worker vẫn chưa được giả lập vì chưa triển khai nghiệp vụ tương ứng. Public Web hiện hiển thị event, organizer, merchandise, bài viết và hồ sơ thay đổi từ API; thao tác mua vé vẫn chưa hoạt động.

## Bảo vệ cấu hình

- `BE/.env` là cấu hình riêng của máy. Sau khi tạo database trong DBeaver, cập nhật `DB_HOST`, `DB_PORT=5432`, `DB_USER`, `DB_PASSWORD` và `DB_NAME`; không sao chép giá trị thật vào tài liệu, source, frontend hoặc `.env.example`.
- Git bỏ qua `.env`, runtime, node_modules, log và build output; `.env.example` được lưu để hướng dẫn cấu hình. Secret guard kiểm tra nội dung staged trong Git và working tree không bị ignore; đây là lớp kiểm tra bổ sung, không thay review bí mật trong lịch sử Git.
- Trên Windows, `setup:env` đặt ACL `.env` cho tài khoản hiện tại, SYSTEM và Administrators; trên Unix file mới có mode 0600. Người có quyền quản trị máy vẫn đọc được file; `.env` không phải kho bí mật mã hóa.
- Vite chỉ đọc env và dependency trong `Fe/`; biến `VITE_*` là công khai. Filesystem dev server giới hạn đúng `Fe/`, chặn `.env`, key và `.git`. Không import code backend vào frontend. Khi scaffold `AdminFe/`, nó phải có package/lockfile/env/tooling riêng và không import runtime từ `Fe/` hoặc `BE/`.
- Public FE gọi `/api/v1` cùng origin qua Vite proxy tới BE cổng 3000. Workspace Organizer nằm trong Public FE và dùng cùng proxy/session. Khi có `AdminFe/`, cấu hình một dev server/port và proxy `/api/v1` riêng nhưng vẫn trỏ tới chính BE cổng 3000; không nhét route Admin vào `Fe/` để tiết kiệm một dev server.
- Local ưu tiên proxy cùng origin nên chưa cần CORS. Production cấu hình hai reverse proxy/TLS riêng cho Public Web và Admin Web, cùng chuyển `/api/v1` tới một backend. Nếu topology thực dùng cross-origin, backend allowlist đúng hai origin theo [12](12-security.md)/[14](14-environment-deployment.md), không dùng wildcard với credentials.
- BE không phục vụ file tĩnh từ thư mục dự án, không log request body/cookie/authorization/query string hoặc raw lỗi SQL. Log request chỉ có request ID do server tạo, method và status.
- Không thay đổi grants hoặc nạp/xóa database khi chạy app. Tài khoản migration tách khỏi runtime khi triển khai; không suy ra quyền thực tế của user PostgreSQL từ tên đăng nhập.

## Clean code và kiểm tra

```powershell
# Chạy tại BE/
npm.cmd run check       # secret guard, lint, typecheck, test, build, format check
npm.cmd run format      # Chỉ format source/config mới; không sửa SQL và ảnh sơ đồ
npm.cmd run db:check    # SELECT 1 + kiểm tra 6 bảng catalog, không đổi schema/dữ liệu

# Chạy tại Fe/
npm.cmd run check       # lint, typecheck, build, format check
npm.cmd run format
```

Mỗi package có Prettier, ESLint và TypeScript strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes riêng. Không dùng `any` tường minh; FE bị chặn import `pg`/code BE. Driver `pg` giữ `BIGINT` dạng chuỗi; connection đặt timezone UTC và `lock_timeout`. Transaction không tự retry khi COMMIT chưa rõ kết quả.

18 test hiện có trong 5 file kiểm tra HTTP/error envelope, OpenAPI/Swagger, catalog API, validation cấu hình, commit/rollback và secret guard. Test không cần tài khoản DB thật và không chạy migration. Các test nghiệp vụ concurrency/E2E ở tài liệu 13 chưa được triển khai đầy đủ.

Đã chạy thành công lint/typecheck/test/build/format. PostgreSQL 18 tạm đã nạp schema/seed và thực thi catalog repository thật; `db:check`/HTTP ready sẽ trả lỗi cho tới khi database được nạp `schema.sql` hoặc `migrations/001-public-catalog.sql`. Đây là kiểm tra fail-closed, không tự sửa database người dùng. Kiểm tra thực tế Vite từ chối đọc `.env`/source BE; quét bundle FE và source không bị Git bỏ qua không tìm thấy các giá trị bí mật trong BE/.env. Chạy lại setup:env giữ nguyên cấu hình và khóa đã tạo. Process và helper kiểm thử được dọn sau mỗi lần kiểm tra; runtime/dependencies phát triển được giữ.

## Rà soát nền tảng ngày 2026-09-13

**Kết luận lịch sử:** phần nhận xét dưới đây ghi lại đợt kiểm tra 2026-09-13. Cấu hình npm workspace và node_modules chung đã được ADR-018 thay thế ngày 2026-09-24 bằng hai package độc lập. `AdminFe/` vẫn là frontend deployable riêng khi bắt đầu triển khai màn hình Admin.

| Phát hiện                                                                       | Xử lý                                                                                                                                   |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| README gốc lẫn hướng dẫn và danh mục 24 tài liệu                                | Viết lại trang giới thiệu/quick start; mục lục tại Docs/README.md                                                                       |
| HTTP client spread HeadersInit làm mất header khi dùng Headers hoặc tuple array | Dùng native Headers và test cả ba dạng đầu vào                                                                                          |
| Lint cấp globals Node cho browser, chưa kiểm tra Promise bị bỏ quên             | Tách môi trường lint, chặn Node globals/builtins/import BE trong Fe/src, bật no-floating-promises/no-misused-promises                   |
| Secret guard chỉ đọc working tree, bỏ sót secret đã staged trước khi sửa file   | Kiểm tra riêng nội dung index Git và working tree; test bằng repository tạm, không in giá trị secret                                    |
| ACL env chưa gỡ quyền Allow tường minh của principal khác                       | Giữ current user/SYSTEM/Administrators, gỡ Allow ngoài danh sách; kiểm tra env hiện có vẫn nguyên nội dung                              |
| Dev server cho phép đọc node_modules chung chứa symlink tới BE                  | Chặn đường dẫn workspace API; smoke test direct path và symlink                                                                         |
| Bộ format/typecheck chưa bao phủ test FE                                        | Bổ sung Fe/tests vào typecheck và lệnh format                                                                                           |
| npm báo postinstall esbuild chưa được xét                                       | Xem script cài binary của bản hiện tại, ghi allowScripts chỉ cho esbuild@0.28.2; không approve toàn bộ package hoặc phiên bản tương lai |

Đã thực hiện: npm ci từ lockfile; npm audit báo 0 lỗ hổng được cơ sở dữ liệu advisory biết tại thời điểm kiểm tra; lint/typecheck/20 test/build/format đạt. 20 test gồm 7 HTTP/config, 6 HTTP client FE, 3 secret guard và 4 transaction unit. Đã chạy trực tiếp API/FE/proxy và PostgreSQL SELECT 1; kiểm tra private-file denial, bundle FE, Git ignore và ACL. Không thay schema, grants hoặc dữ liệu nghiệp vụ. GitHub Actions mới được kiểm tra cấu hình và lệnh tương đương local, chưa chạy trên runner GitHub.

**Giới hạn:** test transaction mới kiểm tra hành vi helper bằng connection mock, không thay integration/concurrency trên PostgreSQL. Auth/authorization, payment, booking, editor, review, worker và migration chưa triển khai; chưa có load test, UI/E2E nghiệp vụ hoặc kiểm chứng production. Rate limit hiện dùng memory, proxy/TLS và secret manager production cần cấu hình theo topology thực. Không kết luận “không còn lỗi” chỉ từ lint hoặc audit. Các mục này nằm trong roadmap 13/16, không phải tính năng bị giả lập bởi scaffold.
