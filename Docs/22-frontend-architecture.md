# 22. Kiến trúc Frontend

## Home và hệ theme đã dựng trong repo

Home hiện có lớp thiết kế riêng ở `shared/styles/classes.ts`: semantic colors theo `.reference-site`, navbar responsive và hero mới, hàng sự kiện có hover giãn thẻ, icon section dùng `SectionEmblem`. Không dùng số thứ tự trang trí. Navbar ẩn khi cuộn xuống và hiện khi cuộn lên; bộ chọn theme dùng menu riêng hỗ trợ bàn phím. Giữ fixture và thứ tự nghiệp vụ hiện có; Variant Tailwind `legacy:` của các trang cũ vẫn được giới hạn trong `.legacy-site`. Các thay đổi này chỉ thuộc giao diện, không thay đổi quyền hoặc quy trình giao dịch.

### Đồng bộ giao diện trực tiếp với project/

Theo yêu cầu ưu tiên giống bản mẫu, trang chủ hiện dùng JSX, fixture, Tailwind CSS và Lucide từ project/, được chuyển vào cấu trúc app/features/shared của Fe. Navbar/Footer trang chủ nằm ở app/layout/home; style nguồn ở shared/styles/classes.ts. Không import project/ lúc chạy. Variant Tailwind `legacy:` của các trang chi tiết cũ giới hạn trong .legacy-site.

Nội dung và số liệu trang chủ là demo theo bản mẫu, không thay đổi hợp đồng nghiệp vụ hoặc xác nhận đối tác/tài khoản/giao dịch thật. Bộ lọc trang chủ dùng state theo mẫu; /reopening giữ lọc URL từ trước. Xem [Fe/README.md](../Fe/README.md) cho phạm vi triển khai hiện tại.

### Phạm vi Fe hiện đã triển khai

`app/routes.tsx` khai báo route; `app/layout/AppShell.tsx` dùng chung Navbar/Footer cho Home và các trang nội dung. `app/SiteLayout.tsx` chỉ giới hạn typography legacy. Giao diện đăng nhập hiện là `features/auth/components/AuthDialog.tsx`, còn context mở dialog ở `features/auth/context`: các đường dẫn `/login`, `/register`, `/organizer`, `/my-tickets` trở về Home và mở dialog theo ngữ cảnh. Đây chỉ là UI xem trước, chưa tạo phiên đăng nhập, vé hoặc quyền truy cập. Khi API auth sẵn sàng, triển khai luồng Google/OTP và route bảo vệ theo phần hợp đồng bên dưới.

Các fixture và component của Blog, merchandise và organizer nằm trong feature tương ứng; `events` chỉ giữ sự kiện, danh mục và vé bán lại. `shared/ui` chỉ giữ thành phần dùng chung, còn card và badge có kiểu dữ liệu sự kiện nằm trong `features/events/components`. `shared/styles/tailwind.css` chỉ chứa ba directive; các selector cần trạng thái cha hoặc SVG con nằm ở `shared/styles/components.css` và được import trực tiếp sau Tailwind.

### Xem nhanh và liên kết catalog

Các nguồn fixture của Home được chuẩn hóa qua `features/events/data/eventCatalog.ts` và `features/merchandise/data/merchandiseCatalog.ts`. Quan hệ organizer, sự kiện, merchandise và vé bán lại dùng ID; component không tự đối chiếu bằng tiêu đề hiển thị. `features/preview` là feature điều phối thẻ xem nhanh dùng chung cho event, organizer, merchandise, bài viết và vé bán lại.

Click một item trên Home đặt `preview` và `previewId` vào query hiện tại rồi mở `QuickPreviewDialog`; đóng dialog xóa hai query này và giữ nguyên bộ lọc/hash. Nút **Xem toàn bộ** điều hướng tới route chi tiết. Các page chi tiết được khai báo bằng `React.lazy` trong `app/routes.tsx`, vì vậy browser chỉ tải chunk JavaScript của page sau khi người dùng yêu cầu xem đầy đủ. Query chỉ chứa loại và ID công khai, không chứa token, giá tin cậy hay dữ liệu xác thực.

## Nguyên tắc bắt buộc

- **Frontend không quyết định quyền, giá hoặc trạng thái thanh toán.** Mọi giá trị nhạy cảm lấy từ server response, không tự tính hoặc cache dài hạn.
- **Không lưu access token vào `localStorage`/`sessionStorage`/URL.** Access token chỉ tồn tại trong memory (biến module, context hoặc closure). Refresh token nằm trong cookie `HttpOnly` do server set.
- **Router guard và permission check ở FE chỉ là UX.** Server kiểm tra lại mọi request. Hiển thị/ẩn element không thay thế authorization thực.
- **Không coi redirect từ payment gateway là bằng chứng thanh toán thành công.** Sau redirect phải poll API để lấy trạng thái booking từ server.
- **ID và tiền nhận từ API là chuỗi.** Không ép sang `Number` hoặc `parseInt` trước khi gửi lại — có thể mất chính xác BIGINT.

---

## Cấu trúc thư mục đích khi các API nghiệp vụ được triển khai

```text
Fe/src/
  main.tsx                     — entry, mount app, setup providers
  app/
    App.tsx                    — router root, global providers
    routes.tsx                 — khai báo route tree và lazy import
    providers/
      AuthProvider.tsx         — quản lý access token trong memory, expose context
      QueryProvider.tsx        — cấu hình HTTP client / query cache
  features/                    — module theo domain nghiệp vụ
    auth/
      pages/
        LoginPage.tsx
        RegisterPage.tsx
        PhoneOtpPage.tsx
        CompanyEmailOtpPage.tsx
        OrganizationApplicationPage.tsx
      components/
        GoogleSignInButton.tsx
        OtpRequestForm.tsx
        OtpVerifyForm.tsx
      hooks/
        useLogin.ts
        useRefresh.ts           — phối hợp refresh giữa các tab
        useLogout.ts
      api/
        auth.api.ts             — gọi /api/v1/auth/*
      types/
        auth.types.ts
    events/
      pages/
        EventListPage.tsx
        EventDetailPage.tsx
      components/
        EventCard.tsx
        EventFilter.tsx
        SessionList.tsx
      hooks/
        useEvents.ts
        useEventDetail.ts
      api/
        events.api.ts
      types/
        event.types.ts
    booking/
      pages/
        SeatPickerPage.tsx      — chọn ghế + đồng hồ hold countdown
        CheckoutPage.tsx        — review đơn, xác nhận giá
        PaymentPage.tsx         — giao diện mock payment
        BookingConfirmPage.tsx  — poll kết quả + hiển thị vé
        BookingListPage.tsx
        BookingDetailPage.tsx
      components/
        SeatMap.tsx             — SVG/Canvas seat picker
        SeatLegend.tsx
        HoldCountdown.tsx       — chỉ hiển thị, không quyết định expiry
        PriceConfirmModal.tsx   — nếu giá thay đổi so với cache
        PaymentMockPanel.tsx    — nhãn "Mô phỏng" rõ ràng
        BookingStatusPoller.tsx — poll /bookings/:id sau payment
      hooks/
        useHold.ts
        useCheckout.ts
        usePayment.ts
        useBookingStatus.ts
      api/
        booking.api.ts
        hold.api.ts
        payment.api.ts
      types/
        booking.types.ts
    tickets/
      pages/
        TicketListPage.tsx
        TicketDetailPage.tsx    — hiển thị QR, no-store header
      components/
        QRDisplay.tsx
        CheckInStatus.tsx
      api/
        ticket.api.ts
      types/
        ticket.types.ts
    organizer/
      pages/
        OrganizerDashboardPage.tsx
        EventManagePage.tsx
        VenueCatalogPage.tsx
        LayoutEditorPage.tsx
        RefundReviewPage.tsx
        SalesReportPage.tsx
        CounterCheckInPage.tsx
        AdmissionScanPage.tsx
      components/
        SessionForm.tsx
        SeatPriceEditor.tsx
        ScanResult.tsx
      api/
        organizer.api.ts
      types/
        organizer.types.ts
    admin/
      pages/
        UserManagePage.tsx
        EventReviewQueuePage.tsx
        ReviewReasonFormPage.tsx
        SupportReportsPage.tsx
        RefundApprovalPage.tsx
        AuditLogPage.tsx
        StatisticsPage.tsx
      api/
        admin.api.ts
      types/
        admin.types.ts
  shared/
    api/
      client.ts                 — HTTP client (fetch/axios wrapper)
      interceptors.ts           — auth header inject, 401 refresh, error normalize
      idempotency.ts            — sinh và attach Idempotency-Key header
      types.ts                  — ApiResponse<T>, ApiError, Pagination
    ui/
      components/               — Button, Input, Modal, Spinner, Toast...
      layouts/
        PublicLayout.tsx
        AuthLayout.tsx
        CustomerLayout.tsx
        OrganizerLayout.tsx
        AdminLayout.tsx
    hooks/
      useAuth.ts                — đọc context từ AuthProvider
      usePermission.ts          — check permission code (UX only)
      useToast.ts
    utils/
      money.ts                  — format tiền từ chuỗi minor unit + currency
      date.ts                   — parse/format ISO 8601, hiển thị theo timezone session
      idGenerator.ts            — tạo idempotency key UUID v4
    constants/
      routes.ts                 — path constants, tránh string literal rải rác
      permissions.ts            — permission code constants
```

---

## Phân tầng và trách nhiệm

| Tầng                  | Trách nhiệm                                             | Không được làm                                  |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| **Page**              | Compose components, đọc route params, điều phối hooks   | Gọi API trực tiếp, chứa business logic          |
| **Component**         | Render UI, phát event lên parent hoặc hook              | Tự quyết định quyền, trạng thái thanh toán, giá |
| **Hook (domain)**     | Gọi API qua `api/`, quản lý loading/error/data local    | Truy cập DOM, render JSX                        |
| **api/ (feature)**    | Gọi `shared/api/client`, serialize request/response DTO | Xử lý auth, retry, idempotency                  |
| **shared/api/client** | HTTP, auth header, token refresh, error normalize       | Biết domain cụ thể nào đang được gọi            |
| **AuthProvider**      | Giữ access token trong memory, expose refresh function  | Lưu token vào storage                           |

---

## Quản lý access token

```
AuthProvider (React Context)
  └── state: { accessToken: string | null, user: UserInfo | null }
  └── loginGoogle(proof) / verifyOtp(challenge, code) → app tokens → lưu token vào memory
  └── refresh()             → POST /auth/refresh (cookie tự đính kèm)
                               → cập nhật state với token mới
  └── logout()              → POST /auth/logout → xóa state + cookie bị clear bởi server
```

**Phối hợp refresh giữa nhiều tab:** Dùng `navigator.locks.request('token-refresh', ...)` để serialize refresh; `BroadcastChannel` có thể thông báo kết quả cho tab chờ nhưng tự nó không phải mutex. Giữ khóa đến khi response/cookie rotation được xử lý. Token nhận qua channel chỉ giữ trong memory, không persist/log. Trình duyệt mục tiêu và fallback cần được kiểm chứng khi chọn công cụ Q-016. Nếu không serialize, hai tab dùng cùng refresh token có thể kích hoạt thu hồi family theo [04 — Refresh và nhiều tab](04-authentication-authorization.md). Không nới replay policy backend để che lỗi phối hợp frontend.

**Interceptor 401:** Khi API trả 401 và access token hết hạn, interceptor gọi `refresh()` một lần, retry request gốc với token mới. Nếu refresh thất bại → logout. Không retry vô hạn.

---

## API client layer

```typescript
// shared/api/client.ts — hợp đồng
interface RequestOptions {
  idempotencyKey?: string; // bắt buộc cho hold, checkout, payment, cancel, check-in, refund
  signal?: AbortSignal;
}

async function apiGet<T>(path: string, options?: RequestOptions): Promise<T>;
async function apiPost<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
async function apiPatch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
async function apiPut<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
async function apiDelete(path: string, options?: RequestOptions): Promise<void>;
```

**Idempotency-Key:** Sinh UUID v4 ở caller (hook), truyền vào `options.idempotencyKey`. Client attach vào header `Idempotency-Key`. Hook giữ key trong `useRef` — không sinh lại khi re-render. Key chỉ đổi khi user bắt đầu thao tác mới.

**Khôi phục hold sau reload:** `useRef` không đủ khi component bị remount hoặc tab reload. Trước POST hold, hook lưu metadata tối thiểu vào `sessionStorage`: phiên bản format, actorId, operation, method, route target, body seatIds đã validate, key và thời điểm bắt đầu. Khi có holdId, lưu ID trước khi điều hướng. Đây là metadata khôi phục thao tác, không phải bằng chứng xác thực/quyền; không lưu access/refresh/reset token, QR, mật khẩu hoặc header bí mật.

Sau reload trong cùng tab, khôi phục phiên trước rồi đối chiếu actorId. Nếu metadata hợp lệ và còn trong cửa sổ replay đã thống nhất với retention Q-013: có holdId thì GET hold, chưa có ID thì gửi lại đúng target/body/key ban đầu, sau đó GET hold để lấy trạng thái mới nhất. Retry do 401 hoặc mất mạng cũng giữ key này. Trong khi chưa xác định kết quả, không coi bấm lại là thao tác mới và không tạo hold khác tự động. Muốn đổi tập ghế phải giải quyết hold cũ, nhả nếu còn ACTIVE, rồi bắt đầu thao tác mới với key mới.

Xóa metadata khi hoàn tất chuyển sang booking đã biết ID, nhả hold hoặc nhận trạng thái kết thúc; logout/đổi tài khoản phải xóa và không replay chéo tài khoản. Nếu phiên hết hạn, tạm dừng recovery đến khi đăng nhập lại đúng actor. Nếu storage không dùng được, dữ liệu bị mất/hỏng, tab đóng hoặc quá cửa sổ retention, không hứa khôi phục tự động: báo chưa xác định kết quả, dùng ID đã biết để tra cứu nếu có, cho khách tải lại tồn kho và chờ hold cũ hết hạn. Không tự gửi lại mutation quá retention. Server luôn validate lại dữ liệu lấy từ storage. Không mở rộng cơ chế lưu body này sang request chứa QR/mật khẩu/token.

`RefundReviewPage` Organizer tải `GET /organizer/refunds?status=REQUESTED`; Admin chỉ mở RefundApprovalPage từ report còn liên quan và gửi reportId. Dùng DTO tối thiểu theo [09](09-api-design.md), quyền/ownership kiểm tra backend. Khi kết quả thay đổi/409, tải lại chi tiết và danh sách; UI không tự coi yêu cầu đã được duyệt.

**Error normalize:** Mọi lỗi HTTP đều được parse thành `ApiError { code: string, message: string, details?: [...] }`. Component xử lý theo `code` ổn định, không parse `message` tiếng Việt.

---

## Routing và protected routes đích

```
/ (PublicLayout)
  /events               — EventListPage
  /events/:eventId      — EventDetailPage
  /login                — LoginPage
  /register             — RegisterPage
  /login/phone          — PhoneOtpPage
  /login/company        — CompanyEmailOtpPage
  /organizations/apply  — OrganizationApplicationPage sau xác thực mail công ty

/ (CustomerLayout — yêu cầu auth + Customer role)
  /events/:eventId/sessions/:sessionId/seats  — SeatPickerPage
  /checkout/:holdId                            — CheckoutPage
  /payment/:bookingId                          — PaymentPage
  /booking/:bookingId/confirm                  — BookingConfirmPage
  /bookings                                    — BookingListPage
  /bookings/:bookingId                         — BookingDetailPage
  /tickets                                     — TicketListPage
  /tickets/:ticketId                           — TicketDetailPage + self check-in tên/mã

/ (OrganizerLayout — yêu cầu auth + Organizer role)
  /organizer/events                    — OrganizerDashboardPage
  /organizer/events/:eventId           — EventManagePage
  /organizer/venues                    — VenueCatalogPage
  /organizer/events/:eventId/layouts/:layoutId — LayoutEditorPage
  /organizer/refunds                   — RefundReviewPage
  /organizer/events/:eventId/sales     — SalesReportPage
  /organizer/sessions/:sessionId/checkin — CounterCheckInPage
  /organizer/sessions/:sessionId/admissions — AdmissionScanPage

/ (AdminLayout — yêu cầu auth + Admin role)
  /admin/users          — UserManagePage
  /admin/event-reviews  — EventReviewQueuePage
  /admin/event-reviews/:reviewId/reason — ReviewReasonFormPage
  /admin/reports        — SupportReportsPage
  /admin/refunds        — RefundApprovalPage
  /admin/audit-logs     — AuditLogPage
  /admin/statistics     — StatisticsPage
```

**Protected route:** Component wrapper kiểm tra `useAuth()` → redirect `/login` nếu chưa auth, redirect `/` nếu sai role. Đây chỉ là UX — server vẫn kiểm tra lại mọi request.

**Google/OTP:** trang đăng nhập dùng Google proof hoặc challenge OTP PHONE/COMPANY_EMAIL theo [04](04-authentication-authorization.md); không có form mật khẩu/reset-password nội bộ. Mã nhập chỉ trong memory, không URL/storage/log; countdown resend chỉ UX, backend enforce limit. AuthProvider khôi phục refresh session sau reload và tải quyền/membership từ server.

---

## Seat map

`SeatMap.tsx` render sơ đồ ghế từ response `GET /events/:eventId/sessions/:sessionId/seats`.

Bảng dưới đọc trường DTO `availability`, không dùng trực tiếp status DB. Server ánh xạ `AVAILABLE_AFTER_CLEANUP` nội bộ thành AVAILABLE theo [09](09-api-design.md); frontend không thêm trạng thái tồn kho mới. Mọi yêu cầu giữ vẫn có thể trả 409 sau khi revalidate.

| Trạng thái ghế               | Hiển thị                    |
| ---------------------------- | --------------------------- |
| `AVAILABLE`                  | Có thể chọn                 |
| `HELD` (người khác, còn hạn) | Grayed out, không chọn được |
| `SOLD`                       | Grayed out                  |
| Đang chọn (local)            | Highlight                   |

**Không tin snapshot UI làm căn cứ checkout.** Khi user submit hold, server kiểm tra lại dưới khóa. Nếu 409 `SEAT_UNAVAILABLE` → hiển thị lỗi, reload snapshot từ server, không tự chọn ghế thay user.

`serverTime` trong response dùng để tính offset đồng hồ client-server. `HoldCountdown` hiển thị `expiresAt - (clientNow + offset)` chỉ để UX, không dùng để quyết định expiry.

---

## Payment mock UI

`PaymentMockPanel.tsx` chỉ render khi `import.meta.env.VITE_MOCK_PAYMENT_VISIBLE === 'true'` cho đích dev/test hoặc staging đã duyệt Q-012; không bật cho APP_ENV=production. Staging có thể dùng NODE_ENV=production để build tối ưu, nên không dùng riêng NODE_ENV làm chính sách môi trường demo. Cờ VITE là công khai và không cấp quyền gọi API. Hiển thị nhãn rõ ràng:

```
⚠️ MÔ PHỎNG THANH TOÁN — Không phải giao dịch thật
[Thành công]  [Thất bại]  [Timeout]
```

Sau khi chọn kịch bản, FE gọi `POST /internal/mock-payments/:paymentId/outcome` với `scenario` và Idempotency-Key theo [09](09-api-design.md). Endpoint chỉ được bật ở môi trường và cho actor được server cho phép; staging phụ thuộc Q-012 và kiểm tra ownership. TIMEOUT giữ payment PENDING để mô phỏng chưa rõ kết quả, không tạo attempt mới. Không giả định thanh toán thành công từ phía client — sau đó vẫn phải poll `/bookings/:bookingId` để nhận trạng thái CONFIRMED từ server. Không nhúng secret/allowlist backend vào frontend; bị từ chối thì hiển thị lỗi quyền bình thường.

---

## Polling sau payment

```
BookingStatusPoller
  └── poll GET /bookings/:bookingId mỗi 2 giây, tối đa 30 giây
  └── dừng khi status = CONFIRMED | EXPIRED | CANCELLED
  └── nếu hết thời gian mà chưa có kết quả: hiển thị "Đang xác minh, vui lòng kiểm tra lại"
  └── không đổi trạng thái UI dựa vào redirect URL
```

Khoảng poll và timeout là đề xuất; cần benchmark với mock payment latency thực.

---

## Xử lý lỗi và UX bắt buộc (NFR-012)

| Tình huống                        | Hành vi FE bắt buộc                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| 409 `SEAT_UNAVAILABLE` khi hold   | Hiển thị "Ghế đã bị giữ bởi người khác", reload seat map, không tự chọn lại        |
| Hold hết hạn (`expiresAt` đã qua) | Hiển thị "Phiên giữ ghế đã hết hạn", nút "Chọn lại ghế"                            |
| Giá server khác giá đang hiển thị | Modal xác nhận giá mới trước khi tiếp tục checkout                                 |
| Payment timeout/chưa rõ           | "Đang xác minh giao dịch..." + nút kiểm tra thủ công                               |
| 401 access token hết hạn          | Tự refresh, retry request gốc, ẩn với người dùng                                   |
| 401 refresh thất bại              | Logout, redirect về `/login`, toast "Phiên đăng nhập đã hết"                       |
| 403                               | "Bạn không có quyền thực hiện thao tác này"                                        |
| 404                               | "Không tìm thấy tài nguyên" — không lộ thông tin owner                             |
| 500/503                           | "Lỗi hệ thống, vui lòng thử lại sau" — không log stack trace ra console production |

---

## Ràng buộc bảo mật FE

- **Không log** access token, refresh token, QR token, thông tin thẻ ra console.
- **QR chỉ hiển thị** qua `<img src="data:...">` được render client-side từ token nhận qua API `no-store`. Không lưu token vào state dài hạn.
- **`dangerouslySetInnerHTML`** chỉ dùng với nội dung đã được sanitize phía server; mặc định dùng React text rendering.
- **`VITE_*` env vars** là public — không đặt secret, key, password vào đây.
- **OTP/Google proof:** chỉ truyền trong body qua HTTPS theo contract, không URL/storage/console; cơ chế nonce/CSRF xử lý ở client auth và backend.

---

## Validation FE (schema biên)

FE validate input trước khi gửi API để UX tốt, **không phải** để đảm bảo bảo mật:

- Email: cú pháp cơ bản
- OTP: format đúng challenge, không coi validate client là xác thực
- Email công ty: format/domain hiển thị, Admin/backend mới quyết định role
- Seat IDs: mảng không rỗng, không trùng
- Số tiền/ID: là chuỗi số nguyên dương
- Các trường text: trim, không để blank bắt buộc

Server validate lại tất cả. FE không block submit chỉ vì validation FE pass — server có thể trả lỗi validation và FE hiển thị theo `details`.

---

## Quyết định cần chốt (Q-016)

| Hạng mục                  | Phương án đề xuất                                | Phụ thuộc |
| ------------------------- | ------------------------------------------------ | --------- |
| Routing library           | React Router v6 hoặc TanStack Router             | Q-016     |
| Server state / API cache  | TanStack Query (React Query)                     | Q-016     |
| Form + validation         | React Hook Form + Zod                            | Q-016     |
| Global state (ngoài auth) | Zustand hoặc React Context                       | Q-016     |
| Seat map rendering        | SVG inline (tọa độ từ `map_x/map_y`)             | Q-014     |
| Accessibility level       | Cần chốt Q-014 trước implement                   |           |
| Internationalization      | Tiếng Việt MVP; i18n library nếu cần đa ngôn ngữ | Q-014     |

Không pin phiên bản cụ thể trong doc; chọn khi bắt đầu Phase 1 và commit `package.json` + lockfile ngay.

## Editor layout trong web

MVP dùng React + SVG như [23](23-organization-review-seatmap.md), không yêu cầu tool ngoài hoặc 3D. Cấu trúc: VenuePicker tải catalog; LayoutCanvas hiển thị viewBox/bounds; ElementPalette thêm sân khấu/vùng cấm; SeatGridForm tạo hàng/lưới ghế; PropertyPanel chỉnh tọa độ/nhãn; CapacityIndicator hiển thị số ghế/maxCapacity; ValidationPanel chỉ rõ phần tử lỗi; PreviewSwitch chuyển sang cách khách nhìn.

Kéo thả và nhập tọa độ đều gọi hook cập nhật cùng model hình học trong memory; feature API chỉ serialize DTO. Backend kiểm tra lại version/scope/collision/bounds/capacity khi PUT. Lưu nháp thất bại không hiển thị đã lưu; 409 version conflict yêu cầu tải lại/giải quyết, không ghi đè âm thầm. Không nhận SVG/HTML tùy ý từ Organizer.

Layout frozen là read-only, preview ghế dùng stable ID; sân khấu/lối đi không phải ghế có thể mua. SeatPicker dùng cùng renderer ở chế độ chọn, availability API và key hold, không tải công cụ editor hoặc tự thay inventory.

## Checkout và check-in như luồng sân bay

Checkout form có một attendeeName cho mỗi ghế; hiển thị loại vé/code và giá snapshot. Không gửi giá do khách nhập. Khi hold đã chuyển, thay tên không được replay thành công như đơn cũ.

TicketDetail hiển thị mã riêng do hệ thống cấp (khác code loại vé) và nút Check-in online từ 24 giờ trước startsAt. Form tên/mã gửi endpoint ticket check-in, server kiểm tra ownership. Thành công ghi “Đã check-in, chưa vào cửa”, không hiển thị “Đã sử dụng”. Có thể đến quầy thay thế; CounterCheckInPage của Organizer nhập tên/mã, vé đã online hiển thị cùng kết quả.

AdmissionScanPage là bước riêng, cần CheckIn và Ticket VALID rồi quét mới USED. Tên/mã/QR không log hoặc lưu persistent cache. Nút/check-in countdown trên frontend không thay kiểm tra serverTime và window backend.

## Màn hình duyệt và form phiếu lý do

EventReviewQueuePage hiển thị tổ chức, event/session sớm nhất, version đã gửi, submittedAt, expiresAt, trạng thái và thời gian còn lại theo serverTime. Không có nút tự sửa nội dung event cho Admin. Approve/reject trong hạn; khi EXPIRED không cho approve và hiện việc “Cần gửi phiếu lý do”.

ReviewReasonFormPage:

- Metadata chỉ đọc: reviewId/eventId, tổ chức, thời điểm gửi/hết hạn.
- reasonCode: select mã lý do, gồm quá hạn review; reasonText: textarea bắt buộc do Admin soạn.
- guidance: hướng dẫn khắc phục/nộp lại; không tự hứa gia hạn hoặc đã được đăng.
- Nút lưu nháp, xem trước, xác nhận gửi. Disable gửi khi thiếu trường; backend validate lại.
- Bản SENT chỉ đọc, hiển thị authoredBy/sentAt. Retry giữ cùng key; không tạo phiếu/thông báo trùng.
- Thông báo hủy hồ sơ do hết hạn đã gửi tự động; form không trì hoãn expiry và không tự có lý do giả được coi là Admin đã ký.

Organizer có NotificationList/NotificationDetail đọc thông báo trong tài khoản; tách “hết hạn hồ sơ” và “phiếu giải thích”. Email gửi thêm có thể retry độc lập.

## Phạm vi Admin và tổ chức trên UI

Organizer shell yêu cầu role + membership + Organization APPROVED + phiên mail công ty; hiển thị tên tổ chức đang thao tác. Admin shell ưu tiên review tổ chức, review event, phiếu lý do và reports; hành động can thiệp booking/refund/block đi từ report detail, không cung cấp workflow sửa hàng loạt event thay Organizer. UI guard chỉ hướng dẫn UX; backend vẫn xác thực scope/report.
