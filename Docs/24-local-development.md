# 24. Môi trường phát triển BE và FE

Đã dựng khung chạy thực tế theo yêu cầu chủ dự án: `BE/`, `Fe/`, `Docs/`, `database/`. npm workspaces điều phối hai app; Node 24.21.0, npm 11.19.0, TypeScript strict, Express 5, React, Vite, mysql2, Zod, Pino, ESLint, Prettier và Vitest. Phiên bản dependency chính xác nằm trong package.json/lockfile.

Cấu hình lint/test/TypeScript chung và script đã gom vào `BE/tooling/`; Node riêng ở `BE/.local/`. Gốc giữ package.json/lockfile, README/PROJECT_RULES, cấu hình Git/npm/editor và CI đúng vị trí công cụ cần. `node_modules/` là thư viện npm workspaces đang sử dụng. Đã bỏ cấu hình Node trùng và thư mục gợi ý VS Code; không xóa các chức năng lint, test hoặc bảo vệ env.

## Chạy trên máy hiện tại

Trong PowerShell tại gốc dự án:

```powershell
. .\BE\tooling\use-node.ps1
npm.cmd run dev
```

- FE: http://127.0.0.1:5173
- BE: http://127.0.0.1:3000
- Liveness: `/api/v1/health/live`.
- Readiness: `/api/v1/health/ready`, kiểm tra kết nối DB bằng SELECT 1, chưa chứng minh schema/migration nghiệp vụ đầy đủ.
- Ctrl+C dừng hai app. API đóng HTTP server và pool, có giới hạn chờ shutdown.

Node được cài riêng trong `BE/.local/node-v24.21.0-win-x64`, kiểm tra SHA256 theo bản phát hành chính thức. Script chỉ thêm PATH trong phiên PowerShell hiện tại, không thay Node toàn máy. Runtime và node_modules được giữ để phát triển; đây là môi trường được yêu cầu, không phải công cụ kiểm thử tạm. [Node releases](https://nodejs.org/en/about/previous-releases), [Vite runtime requirements](https://vite.dev/guide/).

## Máy mới

```powershell
. .\BE\tooling\use-node.ps1
npm.cmd ci
npm.cmd run setup:env
# Điền kết nối MySQL trong BE/.env bằng editor riêng.
npm.cmd run db:check
npm.cmd run dev
```

Linux/macOS dùng Node theo `BE/tooling/.node-version`, rồi `npm ci` và các npm script tương tự. `setup:env` không ghi đè file đã có, tự tạo ba key ngẫu nhiên độc lập dành cho auth/OTP/ticket trong tương lai. Các module này chưa được triển khai; key được tạo không có nghĩa login/JWT đã hoạt động.

## Cấu trúc và trách nhiệm

```text
BE/
  src/
    app.ts                  # Express app factory, test không tự mở cổng
    server.ts               # Entry HTTP, signal và graceful shutdown
    config/                 # Đọc/validate biến môi trường phía server
    modules/                # auth, users, organizations, events, layouts...
    shared/
      database/             # mysql2 pool, UTC và transaction cùng connection
      errors/               # AppError an toàn để trả client
      middleware/           # Error envelope; không trả raw SQL/stack trace
      logging/              # Structured log, field allowlist và redaction
      outbox/               # Chỗ triển khai worker nghiệp vụ sau này
    scripts/                # Kiểm tra kết nối DB chỉ đọc
  tests/                    # Test chính thức, integration/concurrency reserved
  migrations/               # Chưa có runner tự thay đổi schema
  .env                      # Riêng máy, bị Git bỏ qua
  .env.example              # Mẫu không chứa bí mật
Fe/
  src/
    app/                    # Router root và providers
    features/               # auth, events, booking, tickets, organizer
      <feature>/            # pages, components, hooks, api, types
    shared/                 # HTTP client, UI, styles, hooks, utils, constants
  .env                      # Chỉ cấu hình công khai
  .env.example
AdminFe/                    # Đích frontend Admin độc lập; chưa scaffold/chưa vào workspace hiện tại
Docs/                       # Đặc tả, kiến trúc, hướng dẫn và sơ đồ
database/                   # DDL, seed, query hiện có
BE/tooling/                 # Cấu hình chung, setup môi trường, secret guard
.github/workflows/ci.yml    # npm ci + check, không dùng secret DB thật
```

Các module nghiệp vụ là thư mục đã chuẩn bị, chưa có API giả. Khi viết module, tách routes → controller → service → repository; schema/type theo module. Chưa thêm auth/payment provider, worker polling hay migration tự động vì chưa triển khai nghiệp vụ tương ứng. Trang FE là trang khởi đầu, không có sự kiện giả hoặc nút mua hoạt động.

## Bảo vệ cấu hình

- `BE/.env` đã điền thông tin MySQL chủ dự án cung cấp. Không sao chép vào tài liệu, source, frontend hoặc `.env.example`.
- Git bỏ qua `.env`, runtime, node_modules, log và build output; `.env.example` được lưu để hướng dẫn cấu hình. Secret guard kiểm tra nội dung staged trong Git và working tree không bị ignore; đây là lớp kiểm tra bổ sung, không thay review bí mật trong lịch sử Git.
- Trên Windows, `setup:env` đặt ACL `.env` cho tài khoản hiện tại, SYSTEM và Administrators; trên Unix file mới có mode 0600. Người có quyền quản trị máy vẫn đọc được file; `.env` không phải kho bí mật mã hóa.
- Vite hiện chỉ đọc env trong `Fe/`; biến `VITE_*` là công khai. Filesystem dev server giới hạn `Fe/` và node_modules, chặn `.env`, key và `.git`. Không import code backend vào frontend. Khi scaffold `AdminFe/`, nó phải có envDir/filesystem root riêng và không import runtime từ `Fe/` hoặc `BE/`.
- Public FE gọi `/api/v1` cùng origin qua Vite proxy tới BE cổng 3000. Workspace Organizer nằm trong Public FE và dùng cùng proxy/session. Khi có `AdminFe/`, cấu hình một dev server/port và proxy `/api/v1` riêng nhưng vẫn trỏ tới chính BE cổng 3000; không nhét route Admin vào `Fe/` để tiết kiệm một dev server.
- Local ưu tiên proxy cùng origin nên chưa cần CORS. Production cấu hình hai reverse proxy/TLS riêng cho Public Web và Admin Web, cùng chuyển `/api/v1` tới một backend. Nếu topology thực dùng cross-origin, backend allowlist đúng hai origin theo [12](12-security.md)/[14](14-environment-deployment.md), không dùng wildcard với credentials.
- BE không phục vụ file tĩnh từ thư mục dự án, không log request body/cookie/authorization/query string hoặc raw lỗi SQL. Log request chỉ có request ID do server tạo, method và status.
- Không thay đổi grants hoặc nạp/xóa database khi chạy app. Tài khoản migration tách khỏi runtime khi triển khai; không suy ra quyền thực tế của user MySQL từ tên đăng nhập.

## Clean code và kiểm tra

```powershell
npm.cmd run check       # secret guard, lint, typecheck, test, build, format check
npm.cmd run format      # Chỉ format source/config mới; không sửa SQL và ảnh sơ đồ
npm.cmd run db:check    # SELECT 1, không đổi schema/dữ liệu
```

`.editorconfig`, Prettier trong package.json, ESLint flat config trong BE/tooling/, TypeScript strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes đã có. Không dùng `any` tường minh, FE bị chặn import mysql2/code BE. Tiền/BIGINT ở mysql2 giữ dạng chuỗi, không chuyển decimal thành float; UTC và collation được đặt sau khi mở connection. Transaction không tự retry khi COMMIT chưa rõ kết quả.

20 test hiện có kiểm tra HTTP/error envelope, validation cấu hình, HTTP client FE, commit/rollback và secret guard cho nội dung staged. Test không cần tài khoản DB thật và không chạy migration. Các test nghiệp vụ concurrency/E2E ở tài liệu 13 chưa được triển khai bởi khung này.

Đã chạy thành công lint/typecheck/test/build/format, kết nối MySQL local chỉ đọc, HTTP live/ready, trang FE và proxy FE → BE. Kiểm tra thực tế Vite từ chối đọc `.env`/source BE; quét bundle FE và source không bị Git bỏ qua không tìm thấy các giá trị bí mật trong BE/.env. Chạy lại setup:env giữ nguyên cấu hình và khóa đã tạo. Process và helper kiểm thử đã được dọn; runtime/dependencies phát triển được giữ.

## Rà soát nền tảng ngày 2026-09-13

**Kết luận:** cấu trúc hiện tại đủ rõ để tiếp tục Public Web/Organizer và backend modular monolith. `AdminFe/` là frontend deployable riêng bắt buộc khi bắt đầu triển khai màn hình Admin; hiện chưa scaffold nên không được mô tả như tính năng đang chạy. BE/tooling là cấu hình phát triển chung đặt tại BE; các frontend không phụ thuộc runtime backend. Không cần thêm backend service, ORM hoặc database riêng cho Admin.

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

Đã thực hiện: npm ci từ lockfile; npm audit báo 0 lỗ hổng được cơ sở dữ liệu advisory biết tại thời điểm kiểm tra; lint/typecheck/20 test/build/format đạt. 20 test gồm 7 HTTP/config, 6 HTTP client FE, 3 secret guard và 4 transaction unit. Đã chạy trực tiếp API/FE/proxy và MySQL SELECT 1; kiểm tra private-file denial, bundle FE, Git ignore và ACL. Không thay schema, grants hoặc dữ liệu nghiệp vụ. GitHub Actions mới được kiểm tra cấu hình và lệnh tương đương local, chưa chạy trên runner GitHub.

**Giới hạn:** test transaction mới kiểm tra hành vi helper bằng connection mock, không thay integration/concurrency trên MySQL. Auth/authorization, payment, booking, editor, review, worker và migration chưa triển khai; chưa có load test, UI/E2E nghiệp vụ hoặc kiểm chứng production. Rate limit hiện dùng memory, proxy/TLS và secret manager production cần cấu hình theo topology thực. Không kết luận “không còn lỗi” chỉ từ lint hoặc audit. Các mục này nằm trong roadmap 13/16, không phải tính năng bị giả lập bởi scaffold.
