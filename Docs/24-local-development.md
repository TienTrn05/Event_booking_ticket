# 24. Môi trường phát triển BE và FE

Đã dựng khung chạy thực tế theo yêu cầu chủ dự án: `BE/`, `Fe/`, `Docs/`, `database/`. `BE/` và `Fe/` là hai package npm độc lập; Node 24.21.0, npm 11.19.0, TypeScript strict, Express 5, React, Vite, pg, Zod, Pino, ESLint, Prettier và Vitest. Phiên bản dependency chính xác nằm trong package.json/lockfile của từng app.

Mỗi app tự giữ `node_modules`, lockfile và cấu hình phát triển. BE đặt cấu hình TypeScript, ESLint, Vitest và `.node-version` ở gốc `BE/`; script setup, secret guard và runtime helper nằm trong `BE/scripts/`. FE giữ env setup và runtime helper trong `Fe/tooling/`. Gốc repository không có package.json, package-lock.json hoặc node_modules. FE không kế thừa config hay resolve dependency từ BE.

## Sắp xếp công cụ Backend — 2026-10-10

Theo lựa chọn chủ dự án, đã bỏ `BE/tooling/`: cấu hình ESLint, Vitest, TypeScript và `.node-version` chuyển về gốc BE; script hỗ trợ chuyển vào `BE/scripts/`. Đã cập nhật npm scripts, đường dẫn nội bộ, CI và hướng dẫn chạy; FE giữ cấu trúc hiện có.

Kiểm tra: helper chọn đúng Node/npm; ESLint, TypeScript (cả cấu hình build với `--noEmit`), cú pháp script Node và format các file cấu hình/script đã chuyển đều qua. `npm test` và `npm run format:check` chưa qua vì `BE/tests/` đã bị xóa trong working tree trước thay đổi này. Không khôi phục bộ test hoặc ghi đè thay đổi sẵn có.

## Chạy trên máy hiện tại

Mở hai PowerShell tại gốc dự án:

```powershell
# Terminal Backend
cd BE
. .\scripts\use-node.ps1
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

Từ 2026-10-09, theo yêu cầu chủ dự án, BE và FE dùng chung Node 24.21.0/npm 11.19.0 tại `D:\NVM\installs\v24.21.0`. Helper BE đọc `BE/.node-version`, helper FE đọc `Fe/tooling/.node-version`, chọn trực tiếp runtime chung và chỉ thêm PATH trong terminal hiện tại, không đổi symlink Node toàn máy. `.nvmrc` ở gốc giữ cùng phiên bản. Không còn runtime riêng hoặc fallback `.local` trong repository; helper báo lỗi nếu thiếu bản chung.

## Máy mới

Backend:

```powershell
cd BE
. .\scripts\use-node.ps1
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

Linux/macOS dùng Node theo `BE/.node-version` hoặc `Fe/tooling/.node-version`, rồi chạy `npm ci` tại chính `BE/` và `Fe/`. `BE/setup:env` tạo khóa JWT hiện dùng cùng khóa OTP/ticket dành cho các module sau; `Fe/setup:env` chỉ sao chép cấu hình Vite công khai và không ghi đè file đã có.

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
BE/scripts/                 # Script setup môi trường, Node helper, secret guard
BE/*.config.*, tsconfig*.json # Cấu hình Backend ở gốc BE
BE/.node-version            # Phiên bản Node Backend
.github/workflows/ci.yml    # npm ci + check riêng trong BE và Fe
```

Module `catalog` đã có route → service → repository và đọc dữ liệu công khai từ PostgreSQL. Google OAuth 2.0 Authorization Code + PKCE, JWT và refresh cookie đã có trong module auth; cần cấu hình OAuth client trước khi đăng nhập thực tế. Email OTP Customer và linking có mã nguồn ADR-021, cần SMTP/migration để chạy thật; email công ty/booking/payment/worker chưa triển khai. Public Web hiện hiển thị event, organizer, merchandise, bài viết và hồ sơ thay đổi từ API; thao tác mua vé vẫn chưa hoạt động.

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

**Giới hạn:** Google auth có kiểm tra HTTP và refresh/reuse trên PostgreSQL tạm; chưa kiểm thử callback với OAuth client thật hoặc E2E trình duyệt. OTP, phân quyền nghiệp vụ, payment, booking, editor, review, worker và migration runner chưa triển khai; chưa có load test hoặc kiểm chứng production. Rate limit hiện dùng memory, proxy/TLS và secret manager production cần cấu hình theo topology thực. Không kết luận “không còn lỗi” chỉ từ lint hoặc audit. Các mục này nằm trong roadmap 13/16.

## Chuyển từ Node installer sang nvm-windows

1. Mở PowerShell mới sau khi cài nvm. `nvm version` và `nvm list` phải chạy được; nếu không, kiểm tra thư mục nvm/NVM_HOME/PATH trong installer. Không gọi npm cũ khi node chưa hiện.
2. Cấu hình root nvm dùng chung là `D:\NVM\installs`, rồi chạy `nvm install 24.21.0`. Có thể dùng `nvm use 24.21.0` để chọn phiên bản mặc định theo operating mode hiện tại; helper của dự án chọn runtime trong phiên.
3. Trong BE/ và Fe/, chạy `Set-ExecutionPolicy -Scope Process Bypass` nếu PowerShell chặn helper, rồi `. .\scripts\use-node.ps1` trong BE hoặc `. .\tooling\use-node.ps1` trong Fe. Việc Bypass chỉ áp dụng terminal hiện tại. Kiểm tra `node --version`, `npm.cmd --version`, `Get-Command node,npm.cmd`.
4. BE/ chạy `npm.cmd install --ignore-scripts` để cài dependency theo lock và thêm Nodemailer, Fe/ chạy `npm.cmd install --ignore-scripts`. Không xóa .env/database/node_modules do người khác tạo chỉ để sửa PATH. Sau đó `npm.cmd run dev` ở hai terminal; FE 5173, BE 3000.
5. Gmail SMTP: cấu hình theo Docs/27; App Password ngoài Git. DB cũ cần review/backup migration 002; không chạy schema.sql trên dữ liệu hiện có.

### Setup đã xác nhận với nvm-windows 2.0.1

Theo yêu cầu mới ngày 2026-10-09, runtime chuyển sang nvm chung tại `D:\NVM\installs`. Cấu hình cũ từng ưu tiên `.local/nvm/installs` trong repository đã được thay thế; helper BE/FE không gọi nvm từ PATH cũ và không dùng fallback portable. Các thư mục runtime riêng `.local/nvm`, `BE/.local/node-v24.21.0-win-x64`, `Fe/.local/node-v24.21.0-win-x64` được dọn sau khi xác nhận bản chung chạy được. Dependency, lockfile, `.env` và database vẫn được giữ.

Kiểm tra sau chuyển đổi: cả hai helper chọn `node.exe` và `npm.cmd` từ `D:\NVM\installs\v24.21.0`. BE đạt secret guard, lint, typecheck, 4 test, build và format check; 13 integration test được skip vì không bật `AUTH_TEST_DB`. FE đạt toàn bộ `npm run check`; build cần chạy ngoài sandbox để đọc `.env` hiện có. Đã xóa cả ba runtime riêng và các thư mục `.local` rỗng. Không đổi hợp đồng auth hoặc cấu hình bí mật.

[Configuration nvm-windows 2.x](https://docs.nvm-windows.com/cfg/core/).

## Lỗi đăng nhập do Redis local chưa chạy

Khi BE/.env có REDIS_URL, auth rate limiter dùng Redis; npm run dev chỉ chạy Node API. health/config 200 không chứng minh Redis sẵn sàng. Docker Desktop tắt thì Google start/OTP request có thể trả 503 ADMISSION_UNAVAILABLE. Mở Docker Desktop, kiểm tra container eventix-redis-1 healthy; nếu container dừng, chạy npm.cmd run infra:redis trong BE (Redis hiện có, không load balancer/API Docker). Không in docker compose config hoặc command container vì chứa credential.

Web local hiện cấu hình http://127.0.0.1:5173; localhost:5173 khác Origin và bị từ chối. Không tự nới Origin/CSRF hoặc tắt rate limit để vượt lỗi. Khi dịch vụ khôi phục, thử lại Google/OTP; không suy ra email đã gửi hoặc callback đã qua từ config enabled.
