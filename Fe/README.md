# Frontend

**Onboarding2026-10-19:** hành trình toàn màn hình: chọn vai trò bằng thẻ, nhóm tên/giới tính/DOB, mỗi câu active một bước với hình ảnh/thẻ chọn và tìm city/Organizer. Root app inert đến khi hoàn tất, không có bỏ qua; có đáp án tường minh chưa biết Organizer. Admin giữ thêm/bỏ/thứ tự/nhãn, mọi câu đăng ký cần trả lời. Sửa hồ sơ của người đã hoàn tất vẫn dùng phiên bản lịch sử. Source `features/auth/components/RegistrationWizard`, `OnboardingChoices`, schema chung và `onboarding.css`; hợp đồng/giới hạn (`../Docs/50-visual-onboarding.md`, local).

**Sidebar hiện hành2026-10-16:** rail80px, hover mở280px có animation; rời chuột thu lại, giữ mở khi nhập tìm kiếm/dùng menu. Click ngoài/Escape đóng; có focus bàn phím/nút toggle cho cảm ứng, mobile dùng drawer. Không lưu trạng thái mở rộng. Icon SVG tô đặc nhiều màu dùng token chung; theme/ngôn ngữ là nút viên thuốc ở cả hai trạng thái. Xem Docs48 (`../Docs/48-ui-implementation.md#sidebar-hover-icon-màu-đặc-và-nút-viên-thuốc--2026-10-16`, local). Mô tả sidebar264/88px và persistence bên dưới là lịch sử.

**Home/danh sách2026-10-16:** logo và favicon dùng `public/logo.png`. Sidebar desktop mở rộng264px/thu gọn88px, lưu preference không nhạy cảm và giữ drawer đầy đủ trên mobile; icon duotone dùng chung. LanguagePicker là menu có bàn phím, cùng theme Light/Dark. Home chỉ có rail và “Xem tất cả”; search/filter ở trang riêng theo xác nhận chủ dự án. `/events` dùng search/autocomplete/grid/pagination, `?collection=featured` cho nổi bật; category và sidebar search dẫn tới đây. `/organizers`, `/merchandise`, `/blog`, `/reopening` lấy API danh sách đầy đủ, lọc riêng qua q/group; `/for-you` lấy tối đa40 gợi ý hiện có. Bookmark Home có q/category/city/sort chuyển tới `/events`. Xem Docs48 (`../Docs/48-ui-implementation.md#logo-sidebar-thu-gọn-và-trang-bộ-sưu-tập--2026-10-16`, local).

**Cập nhật2026-10-16:** chủ dự án chọn Claude Azure remix cho Light và ProMotor Wow cho Dark, chuyển appbar thành sidebar. `app/layout/SidebarLayout`/`Sidebar` dùng chung Public/Checkout/Workspace; từ1024px sidebar cố định264px, mobile mở native dialog. Theme/locale/tài khoản và tìm kiếm nằm trong sidebar. Picker giao diện có thêm Bật đầy đủ/Giảm/Theo hệ thống cho chuyển động; mặc định bật đầy đủ, chỉ Theo hệ thống tự giảm theo OS. `shared/motion/preference.ts` đồng bộ CSS/hook/scroll/footer; variants `motion-full`/`motion-reduced` thay variant media built-in. Nguồn theme, điều chỉnh tương phản và kiểm chứng hiện hành tại Docs48 (`../Docs/48-ui-implementation.md#theme-chủ-dự-án-chọn-sidebar-và-chuyển-động--2026-10-16`, local); mô tả Ocean & Cosmos/reduced-motion tự động bên dưới là lịch sử.

Trước thiết kế/phục dựng/refactor UI, đọc Docs47 (`../Docs/47-ui-concept-design-system-and-ai-guide.md`, local) và Docs48 — Source/kiểm chứng/giới hạn (`../Docs/48-ui-implementation.md`, local). Chủ dự án đã giao triển khai UI cơ bản Việt–Anh, theme Ocean & Cosmos và logo Eventix. Các ghi chú lịch sử bên dưới không thay trạng thái hiện tại trong Docs48 hoặc quyền/nghiệp vụ đã chốt.

UI hiện dùng `app/layout/AppShell` cho public, `CheckoutLayout` cho mua vé/đơn hàng, `WorkspaceLayout` cho `/organizer/*` và `/admin/*`. Auth provider ở root giữ phiên xuyên layout. Catalog provider không chặn render khi API lỗi. Navbar/footer/logo/component chia sẻ theme token duy nhất; LanguagePicker lưu preference VI/EN, không dịch tự động nội dung trong DB. Public details gọi API riêng ngoài Home; không còn favorite/demo runtime.

Workspace cơ bản đã có source cho tổ chức/sự kiện nháp, editor form đánh số/khu sức chứa, suất/loại vé/giá và gửi/duyệt. Commerce có chọn ghế/khu số lượng, checkout/payment, vé/QR/check-in và merchandise SKU/địa chỉ/đơn/payOS/refund yêu cầu. Các màn chưa có và provider chưa thử live được ghi tại Docs48; không gọi API nội bộ DB từ browser hoặc tự xác nhận tiền/quyền.

Admin có trang `/admin/rbac` quản trị role bổ sung, cấp/thu hồi ADMIN người khác, xem quyền hiệu lực và audit. API yêu cầu ADMIN+rbac.manage, xác thực trong5 phút/lý do/version. Khi cần xác thực mới, đăng xuất phiên hiện tại rồi đăng nhập lại bằng Google/email OTP hiện có. Chính sách/giới hạn (`../Docs/46-dynamic-rbac.md`, local); không dùng role bổ sung để giảm quyền gốc.

Popup Tài khoản có upload avatar qua presigned PUT trực tiếp lên R2. Component `ImageUpload` và helper `uploadImage` dùng chung cho avatar/event/merchandise; editor Organizer chưa có. CORS bucket cần cấu hình theo Docs/28 (`../Docs/28-r2-image-upload.md`, local) trước khi upload từ browser hoạt động.

React + TypeScript + Vite. `src/app` điều phối router/providers; `src/features` chia theo nghiệp vụ; `src/shared` chứa HTTP client và thành phần dùng chung.

Chạy ngay trong thư mục **Fe/** bằng `npm run dev`, mặc định tại http://127.0.0.1:5173. Nếu dùng runtime riêng trên Windows, kích hoạt một lần trong terminal đó:

```powershell
# Dùng Node 24 / npm 11 đã có trong PATH
npm.cmd ci
npm.cmd run dev
```

BE chạy ở terminal riêng trong **BE/** bằng `npm run dev`, cổng 3000. Hai app không trùng cổng. FE có `package-lock.json`, `node_modules`, TypeScript, ESLint và runtime helper riêng; không chạy npm từ gốc repository hoặc dùng dependency của BE.

API cùng origin `/api/v1` qua proxy local tới cổng 3000. `.env` chỉ có cấu hình công khai; mọi biến VITE_ có thể xuất hiện trong bundle. Không đặt credentials DB, OTP hoặc khóa ký tại đây.

Hướng dẫn local (`../Docs/24-local-development.md`, local) · Kiến trúc FE (`../Docs/22-frontend-architecture.md`, local).

## Giao diện theo project/

### Styling bằng Tailwind

- `src/shared/styles/tailwind.css` chỉ chứa ba directive của Tailwind, không có selector CSS viết tay.
- `theme.config.js` chứa token sáng/tối; `tailwind.config.js` cung cấp màu semantic (`bg-home-card`, `text-home-text`, `bg-surface`...), breakpoint và variant `legacy:` để cách ly các trang cũ.
- `src/shared/styles/classes.ts` chứa các nhóm utility literal dùng lại cho component và trạng thái. `ui()` kết hợp các nhóm này với class Tailwind trực tiếp, hỗ trợ tên class động mà vẫn để Tailwind nhận diện class khi build.
- `src/shared/styles/components.css` chứa các selector cần trạng thái của phần tử cha, pseudo-element hoặc SVG con và được import sau Tailwind để Vite theo dõi thay đổi trực tiếp. `no-scrollbar` là utility tự định nghĩa ở đây, không phải class mặc định của Tailwind.
- Component mới dùng utility Tailwind; style dùng lại đưa vào nhóm class chung. Chỉ thêm CSS vào plugin khi utility không diễn tả rõ cấu trúc. Không tạo lại các stylesheet `reference`, `editorial`, `tokens`, `layout`, `discovery` hoặc `responsive` cũ.

Sau khi đổi cấu hình Tailwind/PostCSS, khởi động lại dev server để nạp đủ variant mới.

### Chuyển động

- Ô tìm kiếm Discover và Sidebar dùng `components/ui/animated-input.tsx` (`OrbInput`) từ mẫu chủ dự án gửi: orb GIF local, typewriter Việt–Anh, native input props/ref và bản compact. Source/style/asset và kiểm chứng tại Docs48 (`../Docs/48-ui-implementation.md#orb-input-cho-tìm-kiếm--2026-10-16`, local). React/TypeScript/Tailwind và `components/ui` đã có; mẫu không dùng primitive shadcn nên không cần CLI/alias/dependency mới. Không import demo hoặc thay primitive `shared/ui/Field`.
- `OrbInput` chỉ giữ visual/timer, feature tiếp tục sở hữu q/URL/gợi ý/API. Typewriter dừng khi input focus/có giá trị; GIF/timer dừng khi tab ẩn hoặc ngoài viewport, theo preference motion dùng chung. Reduced motion bỏ GIF, dùng orb tĩnh. GIF lỗi vẫn nhập/tìm bình thường. `public/visuals/search-orb.gif` là asset3.24MB ngoài entry JS; loading lazy và các input dùng cùng URL.

- `config/tailwind/motion.js` giữ animation hero/menu dùng chung. `theme.config.js` chứa easing/thời lượng hover380ms/reveal700ms và màu nền từng nhóm Home; pseudo-element/rail/reveal nằm trong `shared/styles/components.css`.
- `shared/motion/useScrollReveal.ts`: progressive reveal theo viewport, lệch nhịp60ms/tối đa180ms. Nhận card mới sau lọc/tải thêm, bỏ theo dõi node cũ; nội dung không bị ẩn khi không hỗ trợ observer hoặc bật reduced-motion.
- Tiêu đề trượt nhẹ từ trái, card dịch lên16px khi xuất hiện; hover nâng4px, ảnh zoom nhẹ. Nền hero chuyển động chậm. Không dùng delay animation để trì hoãn HTTP; search350ms/suggestions250ms debounce và abort request cũ giữ nguyên.
- `shared/ui/HorizontalRail` dùng cuộn native/snap, nút trái/phải và Arrow/Home/End. Tải thêm ở Discover đưa tới nhóm mới; đổi filter về đầu hàng. Scrollbar ẩn nhưng cuộn wheel/touch/keyboard giữ nguyên. Reduced-motion bỏ reveal/hover và cuộn tức thời.
- `shared/motion/scroll.ts` giữ easing650–1150ms cho anchor; mỗi frame dùng instant để không chồng native smooth và tự hủy khi người dùng cuộn. Reduced-motion đi thẳng tới đích. Home giữ CSS/hook hiện có; Motion chỉ bổ sung theo mẫu footer chủ dự án gửi bên dưới.

### Footer hover theo mẫu chủ dự án

- `src/app/layout/home/Footer.tsx` sở hữu nội dung Eventix Việt–Anh, nhóm link có route thật và CTA Organizer. Reuse `shared/ui/Brand`, locale, theme và scroll helper hiện có; không đưa dữ liệu liên hệ hoặc mạng xã hội mẫu vào sản phẩm.
- `src/components/ui/hover-footer.tsx` là component SVG từ mẫu được điều chỉnh theo token Ocean & Cosmos: `TextHoverEffect` và export `FooterBackgroundGradient`. `footer-artwork.tsx` giữ nền nhẹ, chữ tĩnh dự phòng và tải hiệu ứng khi cách viewport240px. Motion được khóa phiên bản trong package/lockfile; cài bằng `npm ci` như các dependency FE khác.
- Tạo `src/components/ui` theo đường dẫn của mẫu để những visual nhập từ bộ component này có nơi sở hữu rõ. Primitive chuẩn của dự án tiếp tục ở `shared/ui`; không sao chép Button/Brand sang thư mục mới. Mẫu này không dùng primitive shadcn/Radix nên không cần chạy shadcn CLI hoặc thay cấu hình Vite. Tailwind và TypeScript đã được cấu hình; import tương đối thay alias `@/` và không thêm `cn` chỉ để nối một class.
- Hiệu ứng chỉ trang trí, SVG ẩn với screen reader và không chiếm Tab. ID gradient/mask riêng cho từng instance; tọa độ con trỏ được đổi về SVG qua inverse matrix. `shared/motion/useReducedMotion` theo dõi thiết lập hệ thống cả khi trang đang mở; giảm chuyển động giữ chữ tĩnh, dừng spotlight và bỏ vẽ nét.
- CSS pseudo/SVG ở `shared/styles/components.css`; nền/stroke/gradient dùng semantic token hiện có. Theo yêu cầu mới, nền footer phủ toàn bộ chiều ngang trang, bỏ khung bo góc/inset ngoài; nội dung căn giữa tối đa1240px, wordmark1320px, link và nút44px, flex chuyển cột trên mobile. Quote bắt buộc giữ nguyên tiếng Anh trong cả hai locale: “Beyond the ticket. Into the moment.”. Liên hệ và ba URL Facebook/GitHub/Instagram dùng thông tin công khai chủ dự án đã cung cấp, social mở thẻ mới có nhãn và noopener/noreferrer. Giờ08:00–17:00 không tự thêm ngày làm việc; giữ thương hiệu/bản quyền Eventix vì chưa yêu cầu đổi.

### Home được thiết kế lại

Home theo phản hồi chủ dự án: hero gọn; bỏ CatalogTabs lặp menu header; gộp featured/spotlight thành một rail có dedup và không lặp event hero. Một Discover duy nhất giữ toàn bộ tìm kiếm/bộ lọc. Không có section địa điểm riêng lặp khả năng lọc city. Section dùng chung `SectionHeader`/`HorizontalRail`, cỡ featured354/event274/product222/organizer264/story390px co theo viewport. Nổi bật có nền chìm biển/vũ trụ, resale nền ấm/thẻ mép vé/sticker, nhà tổ chức nền xanh dịu, Blog nền tím dịu; tất cả màu ở theme.config.js. Recommendations chỉ hiện dữ liệu cá nhân ngoài nhóm curated. Nội dung/giá/status tiếp tục từ API; không bịa khan hiếm hoặc đánh giá.

Phần dưới ghi lại nguồn chuyển đổi ban đầu; giao diện hiện tại đã được chỉnh theo yêu cầu redesign, không còn giữ nguyên thiết kế của bản mẫu.

Trang chủ đã phục dựng bằng semantic theme và component chia sẻ. Các section sự kiện ở `features/events/components/home`; Blog, merchandise và organizer ở feature tương ứng. Navbar/Footer ở `app/layout/home`, route ở `app/routes.tsx`; UI chung ở `shared/ui`. Ảnh/nội dung lấy từ API, font Plus Jakarta Sans; không import source ngoài Fe khi chạy/build.

Tailwind CSS 3, PostCSS, Autoprefixer và Lucide React phục vụ đúng thiết kế nguồn; FE dùng React 19 và Vite từ package riêng. Styles của bản mẫu ở shared/styles/classes.ts, cấu hình ở tailwind.config.js. Variant Tailwind `legacy:` của các trang cũ được giới hạn trong .legacy-site để không ghi đè trang chủ.

Dữ liệu trang chủ từ `GET /api/v1/catalog/home`, kiểm tra bằng Zod. Deep link event/organizer/product/article gọi endpoint riêng; popup không giả resource không có trong Home. Bộ lọc, sắp xếp và tải thêm nối API; query URL giữ tìm kiếm/category/city. Không còn favorite cục bộ giả lưu thành công. Ảnh ngoài/font cần kết nối mạng; DB trống/lỗi hiển thị trạng thái tương ứng, không chèn dữ liệu mẫu.

Public dùng chung header/footer; `.legacy-site` giữ phần typography chuyển tiếp. `/login` và `/register` mở dialog ở Home; `/organizer` là workspace, `/my-tickets` là vé/đơn vé và `/my-orders` là đơn merchandise. Google/email OTP dùng backend hiện hành, access JWT chỉ trong memory, refresh cookie do BE quản lý. Vai trò theo onboarding tường minh ADR-029; không suy ra quyền từ email/domain. Theme Light/Dark/System và locale đồng bộ preference giữa tab; không đổi credential storage.

Card sự kiện, organizer, merchandise, bài viết và hồ sơ mở bán lại mở cùng một thẻ xem nhanh. Trạng thái xem nhanh nằm trong query `preview` + `previewId` để Back/Forward hoạt động và không làm mất query bộ lọc. Dữ liệu xem nhanh được resolve qua catalog API theo public ID; nút **Xem toàn bộ** đi tới page chi tiết. Các page chi tiết dùng `React.lazy` trong `src/app/routes.tsx`, nên chunk JavaScript tương ứng chỉ được tải khi điều hướng.

Kiểm tra bằng `npm run check` ngay trong `Fe/`.

ADR-021: Google hoặc email/SĐT + email OTP. Đăng ký email + SĐT tùy chọn; navbar tên người dùng mở linking. SMTP config ở BE; không cấp Organizer hoặc xác minh SĐT. Xem Docs/27-email-otp-setup.md.

Runtime Windows dùng chung Node 24.21.0 tại `D:\NVM\installs` (npm 11.19.0). Helper `. .\tooling\use-node.ps1` và `npm run setup:env` chỉ dùng khi có thư mục `tooling/` local; thư mục này không nằm trên GitHub. Clone mới dùng Node/npm trong PATH và sao chép `.env.example` thành `.env` khi cần cấu hình local. `npm run check` không phụ thuộc tooling. Xem Docs/24-local-development.md.

Checkout → payOS → vé/QR và kiểm tra tại cửa đã nối; chi tiết API, quyền staff, kiểm thử và giới hạn ở Docs/32 (`../Docs/32-payos-booking-ticket-flow.md`, local). Không lưu JWT/CCCD/QR trong storage; idempotency key không chứa credential.

Đăng ký mới: xác minh Google/email rồi hoàn tất role/displayName/gender/DOB; sở thích/city/Organizer follow có thể bỏ qua. Sửa trong Tài khoản; Organizer bật Customer riêng khi cần mua vé. Home có gợi ý RULES_V1 từ BE, chưa dùng AI. Cần BE migration008/009 trước dùng, xem Docs/33/34.

## Home event search

ExploreEvents gọi /search/events và /search/events/suggestions, có VI/EN loading/error/retry/no-results, debounce/abort và autocomplete bàn phím. Preview/detail lấy event hiện hành từ public API; kết quả ngoài Home vẫn mở được. FE không giữ credential Elasticsearch. API/cấu hình/kiểm chứng (`../Docs/41-home-event-search.md`, local).
