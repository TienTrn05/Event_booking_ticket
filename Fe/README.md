# Frontend

Popup Tài khoản có upload avatar qua presigned PUT trực tiếp lên R2. Component `ImageUpload` và helper `uploadImage` dùng chung cho avatar/event/merchandise; editor Organizer chưa có. CORS bucket cần cấu hình theo [Docs/28](../Docs/28-r2-image-upload.md) trước khi upload từ browser hoạt động.

React + TypeScript + Vite. `src/app` điều phối router/providers; `src/features` chia theo nghiệp vụ; `src/shared` chứa HTTP client và thành phần dùng chung.

Chạy ngay trong thư mục **Fe/** bằng `npm run dev`, mặc định tại http://127.0.0.1:5173. Nếu dùng runtime riêng trên Windows, kích hoạt một lần trong terminal đó:

```powershell
. .\tooling\use-node.ps1
npm.cmd ci
npm.cmd run dev
```

BE chạy ở terminal riêng trong **BE/** bằng `npm run dev`, cổng 3000. Hai app không trùng cổng. FE có `package-lock.json`, `node_modules`, TypeScript, ESLint và runtime helper riêng; không chạy npm từ gốc repository hoặc dùng dependency của BE.

API cùng origin `/api/v1` qua proxy local tới cổng 3000. `.env` chỉ có cấu hình công khai; mọi biến VITE_ có thể xuất hiện trong bundle. Không đặt credentials DB, OTP hoặc khóa ký tại đây.

[Hướng dẫn local](../Docs/24-local-development.md) · [Kiến trúc FE](../Docs/22-frontend-architecture.md).

## Giao diện theo project/

### Styling bằng Tailwind

- `src/shared/styles/tailwind.css` chỉ chứa ba directive của Tailwind, không có selector CSS viết tay.
- `theme.config.js` chứa token sáng/tối; `tailwind.config.js` cung cấp màu semantic (`bg-home-card`, `text-home-text`, `bg-surface`...), breakpoint và variant `legacy:` để cách ly các trang cũ.
- `src/shared/styles/classes.ts` chứa các nhóm utility literal dùng lại cho component và trạng thái. `ui()` kết hợp các nhóm này với class Tailwind trực tiếp, hỗ trợ tên class động mà vẫn để Tailwind nhận diện class khi build.
- `src/shared/styles/components.css` chứa các selector cần trạng thái của phần tử cha, pseudo-element hoặc SVG con và được import sau Tailwind để Vite theo dõi thay đổi trực tiếp. `no-scrollbar` là utility tự định nghĩa ở đây, không phải class mặc định của Tailwind.
- Component mới dùng utility Tailwind; style dùng lại đưa vào nhóm class chung. Chỉ thêm CSS vào plugin khi utility không diễn tả rõ cấu trúc. Không tạo lại các stylesheet `reference`, `editorial`, `tokens`, `layout`, `discovery` hoặc `responsive` cũ.

Sau khi đổi cấu hình Tailwind/PostCSS, khởi động lại dev server để nạp đủ variant mới.

### Chuyển động

- `config/tailwind/motion.js`: keyframe và thời lượng cho hero, card, navbar, menu và thanh danh mục nổi.
- `src/shared/motion/classes.ts`: utility hover dùng cho từng section.
- `src/shared/motion/useScrollReveal.ts`: quan sát các phần tử `data-reveal`, chạy một lần khi vào màn hình, lệch nhịp 70ms giữa các card (tối đa 210ms). Card mới sau khi lọc hoặc tải thêm cũng được nhận diện.
- Liên kết `#section` dùng đường cuộn có easing 650–1150ms; navbar có ngưỡng chống rung và delay khi ẩn/hiện, gạch chân chạy theo section đang xem. Menu mobile và thanh danh mục nổi đi hẳn từ ngoài màn hình vào, đồng thời có chuyển động khi đóng.
- Tiêu đề vào từ bên trái, card hiện theo scale và lệch nhịp; nền hero chuyển động rất chậm. Hover Trending dùng `flex-grow` 520ms và cùng easing ở cả chiều mở lẫn nhả; chữ hiện bằng opacity sau khi card đổi kích thước.
- Hiệu ứng dùng Tailwind và API trình duyệt, không tải thêm thư viện. Home giữ các chuyển động tương tác mà sản phẩm yêu cầu; focus bàn phím bỏ qua hiệu ứng xuất hiện của phần tử đang thao tác.

### Home được thiết kế lại

Home giữ nội dung và màu xanh Eventix, với hero hai cột, thẻ sự kiện nổi bật một hàng có hover giãn thẻ, section có icon Lucide và nhịp nền riêng. `shared/styles/classes.ts` định nghĩa các lớp nền, chữ và CTA cho cả hai theme; navbar dùng màu semantic, không dùng nền trắng bán trong suốt ở dark mode. Bỏ số trang trí. Resale, địa điểm và Blog dùng hàng ngang gọn; màn hình nhỏ cuộn ngang, nút tối thiểu 44px và focus rõ.

Phần dưới ghi lại nguồn chuyển đổi ban đầu; giao diện hiện tại đã được chỉnh theo yêu cầu redesign, không còn giữ nguyên thiết kế của bản mẫu.

Trang chủ được chuyển từ bản mẫu project/: giữ nội dung demo, ảnh Pexels, font Plus Jakarta Sans, responsive và hiệu ứng hover/scroll. Các section sự kiện ở `features/events/components/home`; Blog, merchandise, auth và dữ liệu organizer ở feature tương ứng. Navbar/Footer ở `app/layout/home`, shell chung ở `app/layout/AppShell.tsx`, route ở `app/routes.tsx`; UI dùng chung ở `shared/ui`. Không import source ngoài Fe khi chạy/build.

Tailwind CSS 3, PostCSS, Autoprefixer và Lucide React phục vụ đúng thiết kế nguồn; FE dùng React 19 và Vite từ package riêng. Styles của bản mẫu ở shared/styles/classes.ts, cấu hình ở tailwind.config.js. Variant Tailwind `legacy:` của các trang cũ được giới hạn trong .legacy-site để không ghi đè trang chủ.

Dữ liệu trang chủ được tải từ `GET /api/v1/catalog/home` qua `features/catalog`. `CatalogProvider` kiểm tra response bằng Zod rồi cung cấp cùng một graph event/organizer/merchandise/article/hồ sơ mở bán cho Home, popup và page chi tiết. Không còn fixture TypeScript làm nguồn dữ liệu runtime. Bộ lọc, sắp xếp, tải thêm, yêu thích, chọn organizer merchandise, menu mobile và đổi theme vẫn chạy tại UI. Ảnh Pexels và font cần kết nối mạng.

Trang chi tiết, Blog, hướng dẫn và `/reopening` dùng chung header/footer với Home; typography cũ được giới hạn trong `.legacy-site`. Tìm kiếm trên `/reopening` dùng URL; trang chủ dùng bộ lọc tại chỗ theo mẫu. Các đường dẫn `/login`, `/register`, `/organizer` trở về Home và mở popup theo ngữ cảnh; `/my-tickets` là trang vé/đơn của Customer. Popup đã nối Google OAuth khi BE được cấu hình; access JWT chỉ giữ trong memory và refresh cookie do BE quản lý. Email OTP Customer có UI theo ADR-021; cần backend SMTP/migration để hoạt động. Email công ty chưa có, đăng nhập Customer không cấp quyền Organizer; vé được BE phát sau xác nhận tiền. Theme Light / Dark / System tiếp tục lưu lựa chọn giao diện và đồng bộ giữa các tab.

Card sự kiện, organizer, merchandise, bài viết và hồ sơ mở bán lại mở cùng một thẻ xem nhanh. Trạng thái xem nhanh nằm trong query `preview` + `previewId` để Back/Forward hoạt động và không làm mất query bộ lọc. Dữ liệu xem nhanh được resolve qua catalog API theo public ID; nút **Xem toàn bộ** đi tới page chi tiết. Các page chi tiết dùng `React.lazy` trong `src/app/routes.tsx`, nên chunk JavaScript tương ứng chỉ được tải khi điều hướng.

Kiểm tra bằng `npm run check` ngay trong `Fe/`.

ADR-021: Google hoặc email/SĐT + email OTP. Đăng ký email + SĐT tùy chọn; navbar tên người dùng mở linking. SMTP config ở BE; không cấp Organizer hoặc xác minh SĐT. Xem Docs/27-email-otp-setup.md.

Runtime Windows dùng chung Node 24.21.0 tại `D:\NVM\installs` (npm 11.19.0). Chạy `. .\tooling\use-node.ps1` trước khi chạy npm.cmd; helper chỉ đổi PATH phiên hiện tại, không còn runtime riêng hoặc fallback `.local`. Xem Docs/24-local-development.md.

Checkout → payOS → vé/QR và kiểm tra tại cửa đã nối; chi tiết API, quyền staff, kiểm thử và giới hạn ở [Docs/32](../Docs/32-payos-booking-ticket-flow.md). Không lưu JWT/CCCD/QR trong storage; idempotency key không chứa credential.

Đăng ký mới: xác minh Google/email rồi hoàn tất role/displayName/gender/DOB; sở thích/city/Organizer follow có thể bỏ qua. Sửa trong Tài khoản; Organizer bật Customer riêng khi cần mua vé. Home có gợi ý RULES_V1 từ BE, chưa dùng AI. Cần BE migration008/009 trước dùng, xem Docs/33/34.
