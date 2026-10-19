# Event Ticketing Platform

GitHub giữ source, cấu hình chạy/build, SQL và README. Tài liệu `Docs/`, bộ test, `scripts/`, `tooling/`, `AGENTS.md` và `PROJECT_RULES.md` chỉ giữ local. GitHub Actions chạy kiểm tra source/build; kiểm thử đầy đủ vẫn chạy local khi có bộ test. Bộ kiểm tra secret phục vụ CI nằm tại `BE/check-secrets.mjs`.

Chạy trọn BE trong `BE/` bằng `docker compose up -d --build --wait --wait-timeout 240`: một API và hai worker trong container ứng dụng, cùng Redis/Elasticsearch; PostgreSQL hiện có và FE giữ riêng. Không cần mở nhiều terminal BE. Setup, log, dừng và phạm vi production (`Docs/49-backend-packaging.md`, local).

Thiết kế và hướng code dùng chung cho AI: Docs47 — Concept, core theme, component, OOP (`Docs/47-ui-concept-design-system-and-ai-guide.md`, local). Chủ dự án đã yêu cầu triển khai UI cơ bản Việt–Anh; Docs48 (`Docs/48-ui-implementation.md`, local) ghi source, kiểm chứng và giới hạn thực tế. Không suy ra mọi tính năng v1 đã có UI từ bản đặc tả.

Quản trị phân quyền: API `/api/v1/admin/rbac`, giao diện `/admin/rbac`, migration018. Admin có rbac.manage tạo/sửa role bổ sung, gán/thu hồi role và ADMIN cho người khác có xác thực lại/lý do/audit. Chính sách và kiểm chứng (`Docs/46-dynamic-rbac.md`, local); role bổ sung cộng quyền, không giảm quyền gốc.

Nền tảng đặt vé sự kiện dành cho khách tham dự và các đơn vị tổ chức. Dự án hướng tới quy trình chọn ghế, thanh toán, nhận vé, check-in và quản lý sự kiện có kiểm soát.

**Giai đoạn hiện tại (2026-10-15):** hoàn thiện BE v1 gồm bán vé indoor/outdoor, auth/onboarding, tổ chức/event, payOS/vé/check-in/refund/report, search/thống kê và bốn phần merchandise/mở bán lại/membership/uy tín. Nghiệm thu v1 (`Docs/43-backend-v1.md`, local), hợp đồng FE (`Docs/44-backend-v1-extensions.md`, local). FE đã nối một phần mua vé, bước tiếp theo là dashboard/luồng mới. CMS sau v1; chưa chuyển/hoàn tiền thật hoặc deploy production.

## Phạm vi sản phẩm

BE đã bổ sung quản lý phiên/logout-all, bộ lọc ngày–giá–ghế, xóa nháp rỗng, report hỗ trợ/audit, phiếu lý do nháp/xem trước, Admin gỡ sự kiện và Customer ẩn Organizer. Hợp đồng hiện hành, migration014 và giới hạn tại Docs40 (`Docs/40-backend-functional-completion.md`, local). Dashboard FE cho các chức năng mới chưa nối; merchandise/giao/hoàn, uy tín, mở bán lại và membership đã chốt/triển khai theo Docs44 (`Docs/44-backend-v1-extensions.md`, local).

- **Khách hàng:** đăng nhập Google/email OTP, chọn ghế, mua vé, khai tên người tham dự và check-in bằng mã vé do hệ thống cấp.
- **Tổ chức:** đăng ký Google/email và chọn Organizer, quản lý sự kiện, suất diễn, loại vé, sơ đồ ghế và hoạt động tại quầy.
- **Admin:** duyệt tổ chức/vai trò, duyệt hồ sơ sự kiện và xử lý yêu cầu hỗ trợ theo report.

Đây là phạm vi sản phẩm đã đặc tả, chưa triển khai đầy đủ. Phần FE đã dựng và giới hạn tại [hướng dẫn frontend](Fe/README.md); hợp đồng nghiệp vụ tại tổ chức, duyệt, feedback và merchandise (`Docs/23-organization-review-seatmap.md`, local).

## Công nghệ

**Quyết định kiến trúc 2026-10-11:** giai đoạn phát triển dùng Modular Monolith với một API instance, ưu tiên hoàn thiện sản phẩm. Mọi thay đổi liên quan distributed system phải hỏi chủ dự án trước khi thực hiện, kể cả load balancer hoặc thử nghiệm nhiều instance. Quy tắc cho người/agent làm việc tiếp theo tại AGENTS.md (`AGENTS.md`, local), PROJECT_RULES.md (`PROJECT_RULES.md`, local) và ADR-025 (`Docs/17-architecture-decisions.md`, local).

BE đã có hồ sơ gender/DOB, theo dõi Organizer/inbox, giới hạn tuổi và thông tin riêng mỗi vé theo ADR-023. Worker riêng xử lý notification/xóa CCCD quá hạn. FE checkout/payOS/vé và kiểm tra cửa đã nối API; xem luồng và giới hạn kiểm chứng (`Docs/32-payos-booking-ticket-flow.md`, local). Chưa thử chuyển tiền thật hoặc onboarding company Organizer.

Ảnh upload dùng Cloudflare R2 qua presigned PUT 5 phút: client tải trực tiếp, BE xác minh và DB chỉ lưu URL. Xem cấu hình, CORS và trạng thái thực tế (`Docs/28-r2-image-upload.md`, local).

| Thành phần      | Công nghệ                                                           |
| --------------- | ------------------------------------------------------------------- |
| Frontend        | React, TypeScript, Vite, React Router                               |
| Backend         | Node.js, Express, TypeScript; modular monolith                      |
| Database        | PostgreSQL 16+, `pg`/SQL; Prisma thử nghiệm preference ẩn Organizer |
| Chất lượng code | ESLint, Prettier, Vitest, Supertest                                 |

Phiên bản dependency được cố định độc lập trong `BE/package.json` + `BE/package-lock.json` và `Fe/package.json` + `Fe/package-lock.json`. Runtime local dùng Node **24.21.0**, npm **11.19.0**; database yêu cầu PostgreSQL **16+**, đã kiểm tra local trên **18**.

## Cấu trúc dự án

```text
BE/                 Backend, test, cấu hình và node_modules riêng
  src/              Config, module nghiệp vụ và thành phần dùng chung
  tests/            Test backend và kiểm tra công cụ bảo mật
  scripts/          Script chọn Node, setup env và kiểm tra bí mật
  *.config.*, tsconfig*.json  Cấu hình lint/test/TypeScript ở gốc BE
Fe/                 Frontend, cấu hình, node_modules, tính năng và UI riêng
Docs/               Đặc tả, kiến trúc, hướng dẫn và sơ đồ
database/           Schema SQL, seed và truy vấn mẫu
PROJECT_RULES.md     Quy tắc phát triển bắt buộc
README.md           Giới thiệu và hướng dẫn bắt đầu
```

BE và FE là hai package npm độc lập, không dùng npm workspaces và không có `node_modules` ở gốc. Mỗi app tự giữ lockfile và tooling; runtime Windows dùng chung nvm tại `D:\NVM\installs`, không giữ Node riêng hoặc fallback `.local` trong project. Dependency `node_modules` vẫn riêng cho từng app và được Git bỏ qua.

## Bắt đầu phát triển

### 1. Chuẩn bị Node và cài thư viện

Mở hai PowerShell. Cài Backend trong chính thư mục `BE/`:

```powershell
cd BE
. .\scripts\use-node.ps1
npm.cmd ci
npm.cmd run setup:env
```

Cài Frontend trong chính thư mục `Fe/`:

```powershell
cd Fe
. .\tooling\use-node.ps1
npm.cmd ci
npm.cmd run setup:env
```

Cài Node 24.21.0 trong nvm dùng chung tại `D:\NVM\installs` trước khi dùng helper. Helper chọn trực tiếp runtime chung và chỉ đổi PATH của terminal hiện tại. `setup:env` chỉ quản lý `.env` của app đang đứng. Trên Linux/macOS, cài đúng phiên bản Node ghi trong `BE/.node-version` hoặc `Fe/tooling/.node-version` rồi dùng các lệnh npm tương ứng.

### 2. Tạo PostgreSQL bằng DBeaver

Tạo database `event_ticketing` trong DBeaver, chạy `database/schema.sql`, rồi `database/seeds/001-reference-data.sql`. Nếu muốn dữ liệu demo cho Public Web, chạy thêm `database/seeds/002-public-catalog.sql`. Hướng dẫn cho database mới và database ADR-014 cũ nằm tại [database/README.md](database/README.md).

Trong terminal đang đứng ở **BE/**, điền thông tin PostgreSQL vào `.env` theo `.env.example` (`DB_PORT=5432`), rồi kiểm tra kết nối:

```powershell
npm.cmd run db:check
```

Lệnh này chỉ đọc, kiểm tra kết nối,51 bảng nghiệp vụ và các mốc schema cần thiết đến018, không tạo bảng hoặc thay đổi dữ liệu. Nếu cần khởi tạo database **rỗng** hoặc nâng schema cũ, làm theo [hướng dẫn SQL](database/README.md). Không dùng schema.sql để nâng cấp database đang có dữ liệu.

### 3. Chạy BE và FE

```powershell
# Terminal 1: BE/
npm.cmd run dev

# Terminal 2: Fe/
npm.cmd run dev
```

| Địa chỉ                                   | Chức năng                            |
| ----------------------------------------- | ------------------------------------ |
| http://127.0.0.1:5173                     | Frontend                             |
| http://127.0.0.1:3000/api/v1/health/live  | Kiểm tra API đang chạy               |
| http://127.0.0.1:3000/api/v1/health/ready | Kiểm tra kết nối và schema catalog   |
| http://127.0.0.1:3000/api/docs/           | Swagger UI của API hiện có           |
| http://127.0.0.1:3000/api/v1/openapi.json | OpenAPI JSON cho sinh client/tooling |

FE gọi API qua đường dẫn cùng origin `/api/v1` và proxy của Vite. Nhấn Ctrl+C trong từng terminal để dừng app tương ứng. Những lần mở PowerShell mới, chạy lại `scripts/use-node.ps1` trong BE hoặc `tooling/use-node.ps1` trong Fe trước các lệnh npm.

## Các lệnh thường dùng

Có thể chạy riêng **ngay trong mỗi folder**, không bắt buộc đứng ở gốc. Mở hai terminal:

```powershell
# Terminal FE, bắt đầu tại gốc repository
cd Fe
. .\tooling\use-node.ps1
npm.cmd run dev
```

```powershell
# Terminal BE, bắt đầu tại gốc repository
cd BE
. .\scripts\use-node.ps1
npm.cmd run dev
```

FE dùng **5173**, BE dùng **3000**, không trùng nhau. Mỗi app giữ package npm và lockfile riêng; chạy lệnh trong `BE/` hoặc `Fe/` tương ứng.

Chạy trong từng thư mục `BE/` hoặc `Fe/`:

| Lệnh               | BE                                                      | FE                             |
| ------------------ | ------------------------------------------------------- | ------------------------------ |
| `npm run dev`      | API cổng 3000                                           | Vite cổng 5173                 |
| `npm run check`    | Secret guard, lint, typecheck, test auth, build, format | Lint, typecheck, build, format |
| `npm run check:ci` | Kiểm tra source/build, không cần bộ test local          | Không áp dụng                  |
| `npm run format`   | Format source/config BE                                 | Format source/config FE        |
| `npm run db:check` | Kiểm tra PostgreSQL chỉ đọc                             | Không áp dụng                  |

Trên PowerShell có thể dùng npm.cmd để tránh gọi nhầm npm.ps1. Build output không phải bản triển khai production hoàn chỉnh.

## Quy tắc đóng góp

Đọc PROJECT_RULES.md (`PROJECT_RULES.md`, local) trước khi sửa code. Controller chỉ xử lý HTTP, service giữ nghiệp vụ và transaction, repository truy vấn DB bằng connection được truyền vào. Frontend không quyết định quyền, giá hoặc trạng thái thanh toán.

Không commit .env, token, khóa bí mật hoặc thông tin kết nối thật. Fe/.env chỉ chứa cấu hình công khai; mọi biến VITE_ có thể xuất hiện trong bundle. Bản clone từ GitHub chạy `npm run check:ci` trong BE và `npm run check` trong Fe; bản local có bộ test tiếp tục dùng `npm run check` trong BE để kiểm tra đầy đủ.

## Tài liệu

- Mục lục tài liệu (`Docs/README.md`, local)
- Môi trường local và kết quả rà soát setup (`Docs/24-local-development.md`, local)
- Thiết kế backend (`Docs/10-backend-architecture.md`, local) · Thiết kế frontend (`Docs/22-frontend-architecture.md`, local)
- [SQL và cách nạp](database/README.md) · Sơ đồ và kiến trúc hiện hành (`Docs/19-system-diagrams.md`, local)
- Lộ trình (`Docs/16-roadmap.md`, local) · Quyết định còn mở (`Docs/18-open-questions.md`, local)

Auth ADR-021/029: Google hoặc email/SĐT + OTP email SMTP Gmail; dùng chung User sau liên kết tường minh, SĐT alias chưa xác minh. Vai trò Customer/Organizer chọn khi onboarding, không bắt buộc mail công ty. Xem cấu hình OTP (`Docs/27-email-otp-setup.md`, local) và đăng ký (`Docs/33-registration-onboarding.md`, local).

Onboarding hiện hành theo ADR-029 (`Docs/17-architecture-decisions.md`, local): chọn Customer hoặc Organizer bằng Google/email cá nhân, nhập tên/giới tính/ngày sinh; sở thích/thành phố/theo dõi tùy chọn. Organizer tạo nháp trước khi duyệt, bật Customer sau nếu muốn mua vé. Hợp đồng đăng ký (`Docs/33-registration-onboarding.md`, local), API Organizer/Admin (`Docs/34-organizer-event-api.md`, local). Mô tả email công ty ở các đoạn cũ đã được thay.

## Tìm sự kiện trên Home — 2026-10-14

Ô search Home đã nối Elasticsearch một instance được chủ dự án chấp thuận, PostgreSQL dữ liệu gốc, Redis cache; English search theo tên/Organizer/địa điểm, fuzzy/N-gram/prefix/completion, filters/phân trang và preview từ API. API vẫn monolith một instance. Trong BE: npm run search:setup, npm run infra:search, migration015 nếu DB chưa có, npm run search:reindex; start:monolith giữ worker đồng bộ. Local đã apply015/backfill; không chạy migration lại. Hướng dẫn, API và kiểm chứng (`Docs/41-home-event-search.md`, local).

## Indoor/outdoor BE — 2026-10-14

BE có indoor ghế đánh số và outdoor theo khu/sức chứa. Organizer tạo draft ticketingMode QUANTITY, cấu hình zone-layouts/zone-prices rồi gửi Admin duyệt; khách GET zones và POST zones/hold theo số lượng, tiếp tục checkout/payOS/QR/check-in/refund/cancel hiện hành. FE editor/picker khu chưa nối. Health Admin và API cùng kiểm tra Elasticsearch. API, migration016, dữ liệu và kiểm chứng (`Docs/42-outdoor-zone-ticketing.md`, local).
