# Event Ticketing Platform

Nền tảng đặt vé sự kiện dành cho khách tham dự và các đơn vị tổ chức. Dự án hướng tới quy trình chọn ghế, thanh toán, nhận vé, check-in và quản lý sự kiện có kiểm soát.

**Giai đoạn hiện tại:** đã có đặc tả nghiệp vụ, thiết kế SQL và khung backend/frontend chạy được. Chức năng đăng nhập, mua vé, thiết kế sơ đồ ghế và duyệt sự kiện đang chờ triển khai. Đây chưa phải sản phẩm sẵn sàng vận hành thực tế.

## Phạm vi sản phẩm

- **Khách hàng:** đăng nhập Google/OTP, chọn ghế, mua vé, khai tên người tham dự và check-in bằng mã vé do hệ thống cấp.
- **Tổ chức:** đăng ký bằng email công ty, quản lý sự kiện, suất diễn, loại vé, sơ đồ ghế và hoạt động tại quầy.
- **Admin:** duyệt tổ chức/vai trò, duyệt hồ sơ sự kiện và xử lý yêu cầu hỗ trợ theo report.

Đây là phạm vi đã đặc tả; khung hiện tại mới cung cấp trang FE khởi đầu, API health và cấu hình nền tảng. Chi tiết tại [nghiệp vụ tổ chức, duyệt sự kiện và seat map](Docs/23-organization-review-seatmap.md).

## Công nghệ

| Thành phần      | Công nghệ                                      |
| --------------- | ---------------------------------------------- |
| Frontend        | React, TypeScript, Vite, React Router          |
| Backend         | Node.js, Express, TypeScript; modular monolith |
| Database        | MySQL/InnoDB, mysql2, SQL có tham số           |
| Chất lượng code | ESLint, Prettier, Vitest, Supertest            |

Phiên bản dependency được cố định trong package.json và package-lock.json. Runtime local dùng Node **24.21.0**, npm **11.19.0**; database yêu cầu MySQL **8.0.16+**, đã kiểm tra local trên **8.0.46**.

## Cấu trúc dự án

```text
BE/                 Backend, test và công cụ phát triển dùng chung
  src/              Config, module nghiệp vụ và thành phần dùng chung
  tests/            Test backend và kiểm tra công cụ bảo mật
  tooling/          Cấu hình lint/test/TypeScript, script setup
Fe/                 Frontend, tính năng, UI và HTTP client
Docs/               Đặc tả, kiến trúc, hướng dẫn và sơ đồ
database/           Schema SQL, seed và truy vấn mẫu
PROJECT_RULES.md     Quy tắc phát triển bắt buộc
README.md           Giới thiệu và hướng dẫn bắt đầu
```

package.json/lockfile ở gốc điều phối hai app qua npm workspaces. node_modules và runtime riêng trong BE/.local là dữ liệu cài đặt trên máy, được Git bỏ qua.

## Bắt đầu phát triển

### 1. Chuẩn bị Node và cài thư viện

Mở PowerShell tại thư mục gốc:

```powershell
. .\BE\tooling\use-node.ps1
npm.cmd ci
npm.cmd run setup:env
```

Script Node dành cho Windows x64, cài runtime riêng trong dự án và chỉ đổi PATH của phiên PowerShell hiện tại. setup:env tạo file còn thiếu, giữ nguyên cấu hình đã có. Trên Linux/macOS, cài đúng phiên bản Node ghi ở BE/tooling/.node-version rồi dùng các lệnh npm tương ứng.

### 2. Cấu hình MySQL

Điền thông tin kết nối vào **BE/.env** theo mẫu BE/.env.example. MySQL phải đang chạy và tài khoản phải được phép truy cập database đã chọn.

```powershell
npm.cmd run db:check
```

Lệnh này chỉ kiểm tra kết nối bằng SELECT 1, không tạo bảng hoặc thay đổi dữ liệu. Nếu cần khởi tạo một database **rỗng**, làm theo [hướng dẫn SQL](database/README.md). Không dùng schema.sql để nâng cấp database đang có dữ liệu.

### 3. Chạy BE và FE

```powershell
npm.cmd run dev
```

| Địa chỉ                                   | Chức năng                 |
| ----------------------------------------- | ------------------------- |
| http://127.0.0.1:5173                     | Frontend                  |
| http://127.0.0.1:3000/api/v1/health/live  | Kiểm tra API đang chạy    |
| http://127.0.0.1:3000/api/v1/health/ready | Kiểm tra kết nối database |

FE gọi API qua đường dẫn cùng origin /api/v1 và proxy của Vite. Nhấn Ctrl+C để dừng hai app. Những lần mở PowerShell mới, chạy lại use-node.ps1 trước các lệnh npm.

## Các lệnh thường dùng

Chạy từ thư mục gốc:

| Lệnh                              | Mục đích                                                    |
| --------------------------------- | ----------------------------------------------------------- |
| npm run dev                       | Chạy đồng thời BE và FE                                     |
| npm run dev:api / npm run dev:web | Chạy riêng từng app                                         |
| npm run check                     | Secret guard, lint, typecheck, test, build, kiểm tra format |
| npm run format                    | Format các file source/config được chỉ định                 |
| npm run db:check                  | Kiểm tra kết nối MySQL chỉ đọc                              |

Trên PowerShell có thể dùng npm.cmd để tránh gọi nhầm npm.ps1. Build output không phải bản triển khai production hoàn chỉnh.

## Quy tắc đóng góp

Đọc [PROJECT_RULES.md](PROJECT_RULES.md) trước khi sửa code. Controller chỉ xử lý HTTP, service giữ nghiệp vụ và transaction, repository truy vấn DB bằng connection được truyền vào. Frontend không quyết định quyền, giá hoặc trạng thái thanh toán.

Không commit .env, token, khóa bí mật hoặc thông tin kết nối thật. Fe/.env chỉ chứa cấu hình công khai; mọi biến VITE_ có thể xuất hiện trong bundle. Chạy npm run check trước khi gửi thay đổi và bổ sung test cho hành vi mới.

## Tài liệu

- [Mục lục tài liệu](Docs/README.md)
- [Môi trường local và kết quả rà soát setup](Docs/24-local-development.md)
- [Thiết kế backend](Docs/10-backend-architecture.md) · [Thiết kế frontend](Docs/22-frontend-architecture.md)
- [SQL và cách nạp](database/README.md) · [Sơ đồ hệ thống](Docs/diagrams/index.html)
- [Lộ trình](Docs/16-roadmap.md) · [Quyết định còn mở](Docs/18-open-questions.md)
