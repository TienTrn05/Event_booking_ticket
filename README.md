# Event Ticketing Platform

Nền tảng đặt vé sự kiện dành cho khách tham dự và các đơn vị tổ chức. Dự án hướng tới quy trình chọn ghế, thanh toán, nhận vé, check-in và quản lý sự kiện có kiểm soát.

**Giai đoạn hiện tại:** đã có đặc tả, PostgreSQL schema, Swagger, backend catalog và FE khám phá sự kiện với theme Biển xanh/Vũ trụ. FE lấy event, organizer, venue, merchandise, bài viết và hồ sơ mở bán từ API thật; đăng nhập, mua vé, giao dịch merchandise, editor và duyệt sự kiện chưa được tích hợp. Đây chưa phải sản phẩm sẵn sàng vận hành thực tế.

## Phạm vi sản phẩm

- **Khách hàng:** đăng nhập Google/OTP, chọn ghế, mua vé, khai tên người tham dự và check-in bằng mã vé do hệ thống cấp.
- **Tổ chức:** đăng ký bằng email công ty, quản lý sự kiện, suất diễn, loại vé, sơ đồ ghế và hoạt động tại quầy.
- **Admin:** duyệt tổ chức/vai trò, duyệt hồ sơ sự kiện và xử lý yêu cầu hỗ trợ theo report.

Đây là phạm vi sản phẩm đã đặc tả, chưa triển khai đầy đủ. Phần FE đã dựng và giới hạn tại [hướng dẫn frontend](Fe/README.md); hợp đồng nghiệp vụ tại [tổ chức, duyệt, feedback và merchandise](Docs/23-organization-review-seatmap.md).

## Công nghệ

| Thành phần      | Công nghệ                                      |
| --------------- | ---------------------------------------------- |
| Frontend        | React, TypeScript, Vite, React Router          |
| Backend         | Node.js, Express, TypeScript; modular monolith |
| Database        | PostgreSQL 16+, `pg`, SQL có tham số            |
| Chất lượng code | ESLint, Prettier, Vitest, Supertest            |

Phiên bản dependency được cố định độc lập trong `BE/package.json` + `BE/package-lock.json` và `Fe/package.json` + `Fe/package-lock.json`. Runtime local dùng Node **24.21.0**, npm **11.19.0**; database yêu cầu PostgreSQL **16+**, đã kiểm tra local trên **18**.

## Cấu trúc dự án

```text
BE/                 Backend, test, cấu hình và node_modules riêng
  src/              Config, module nghiệp vụ và thành phần dùng chung
  tests/            Test backend và kiểm tra công cụ bảo mật
  tooling/          Cấu hình lint/test/TypeScript, script setup
Fe/                 Frontend, cấu hình, node_modules, tính năng và UI riêng
Docs/               Đặc tả, kiến trúc, hướng dẫn và sơ đồ
database/           Schema SQL, seed và truy vấn mẫu
PROJECT_RULES.md     Quy tắc phát triển bắt buộc
README.md           Giới thiệu và hướng dẫn bắt đầu
```

BE và FE là hai package npm độc lập, không dùng npm workspaces và không có `node_modules` ở gốc. Mỗi app tự giữ lockfile, tooling và runtime Windows trong `.local`; toàn bộ dữ liệu cài đặt này được Git bỏ qua.

## Bắt đầu phát triển

### 1. Chuẩn bị Node và cài thư viện

Mở hai PowerShell. Cài Backend trong chính thư mục `BE/`:

```powershell
cd BE
. .\tooling\use-node.ps1
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

Mỗi script Node Windows x64 chỉ đổi PATH của terminal hiện tại. `setup:env` chỉ quản lý `.env` của app đang đứng. Trên Linux/macOS, cài đúng phiên bản Node ghi trong `tooling/.node-version` của từng app rồi dùng các lệnh npm tương ứng.

### 2. Tạo PostgreSQL bằng DBeaver

Tạo database `event_ticketing` trong DBeaver, chạy `database/schema.sql`, rồi `database/seeds/001-reference-data.sql`. Nếu muốn dữ liệu demo cho Public Web, chạy thêm `database/seeds/002-public-catalog.sql`. Hướng dẫn cho database mới và database ADR-014 cũ nằm tại [database/README.md](database/README.md).

Trong terminal đang đứng ở **BE/**, điền thông tin PostgreSQL vào `.env` theo `.env.example` (`DB_PORT=5432`), rồi kiểm tra kết nối:

```powershell
npm.cmd run db:check
```

Lệnh này chỉ đọc `SELECT 1` và kiểm tra 6 bảng catalog ADR-017, không tạo bảng hoặc thay đổi dữ liệu. Nếu cần khởi tạo một database **rỗng** hoặc nâng database 38 bảng, làm theo [hướng dẫn SQL](database/README.md). Không dùng schema.sql để nâng cấp database đang có dữ liệu.

### 3. Chạy BE và FE

```powershell
# Terminal 1: BE/
npm.cmd run dev

# Terminal 2: Fe/
npm.cmd run dev
```

| Địa chỉ                                   | Chức năng                 |
| ----------------------------------------- | ------------------------- |
| http://127.0.0.1:5173                     | Frontend                  |
| http://127.0.0.1:3000/api/v1/health/live  | Kiểm tra API đang chạy    |
| http://127.0.0.1:3000/api/v1/health/ready | Kiểm tra kết nối và schema catalog |
| http://127.0.0.1:3000/api/docs/ | Swagger UI của API hiện có |
| http://127.0.0.1:3000/api/v1/openapi.json | OpenAPI JSON cho sinh client/tooling |

FE gọi API qua đường dẫn cùng origin `/api/v1` và proxy của Vite. Nhấn Ctrl+C trong từng terminal để dừng app tương ứng. Những lần mở PowerShell mới, chạy lại `tooling/use-node.ps1` của app đó trước các lệnh npm.

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
. .\tooling\use-node.ps1
npm.cmd run dev
```

FE dùng **5173**, BE dùng **3000**, không trùng nhau. Gốc repository không còn package npm và không còn lệnh chạy chung. Folder `project/` là bản export tham khảo; app phát triển và chạy chính thức nằm ở `Fe/`, không chạy hai FE cùng lúc trên 5173.

Chạy trong từng thư mục `BE/` hoặc `Fe/`:

| Lệnh              | BE | FE |
| ----------------- | -- | -- |
| `npm run dev`     | API cổng 3000 | Vite cổng 5173 |
| `npm run check`   | Secret guard, lint, typecheck, 18 test, build, format | Lint, typecheck, build, format |
| `npm run format`  | Format source/config BE | Format source/config FE |
| `npm run db:check`| Kiểm tra PostgreSQL chỉ đọc | Không áp dụng |

Trên PowerShell có thể dùng npm.cmd để tránh gọi nhầm npm.ps1. Build output không phải bản triển khai production hoàn chỉnh.

## Quy tắc đóng góp

Đọc [PROJECT_RULES.md](PROJECT_RULES.md) trước khi sửa code. Controller chỉ xử lý HTTP, service giữ nghiệp vụ và transaction, repository truy vấn DB bằng connection được truyền vào. Frontend không quyết định quyền, giá hoặc trạng thái thanh toán.

Không commit .env, token, khóa bí mật hoặc thông tin kết nối thật. Fe/.env chỉ chứa cấu hình công khai; mọi biến VITE_ có thể xuất hiện trong bundle. Chạy `npm run check` trong cả `BE/` và `Fe/` trước khi gửi thay đổi.

## Tài liệu

- [Mục lục tài liệu](Docs/README.md)
- [Môi trường local và kết quả rà soát setup](Docs/24-local-development.md)
- [Thiết kế backend](Docs/10-backend-architecture.md) · [Thiết kế frontend](Docs/22-frontend-architecture.md)
- [SQL và cách nạp](database/README.md) · [Sơ đồ hệ thống](Docs/diagrams/index.html)
- [Lộ trình](Docs/16-roadmap.md) · [Quyết định còn mở](Docs/18-open-questions.md)
