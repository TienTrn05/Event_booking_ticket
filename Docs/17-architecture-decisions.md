# 17. Architecture Decision Records

ADR lưu lịch sử thiết kế. Chủ dự án đã chấp thuận khuyến nghị kèm thay đổi 2026-09-12: trạng thái quyết định hiện hành ở [18](18-open-questions.md), thay đổi tại ADR-013. Các đoạn đề xuất cũ không tự ghi đè quyết định mới; phần auth/ownership/check-in/refund/venue bị thay thế được liệt kê trong ADR-013.

## ADR-012 — Hoàn thiện hợp đồng request và tích hợp UI sau audit

- **Trạng thái:** đặc tả kỹ thuật bổ sung theo yêu cầu cập nhật Markdown; chưa có implementation. Phạm vi refund Q-004/Q-005, mock staging Q-012 và retention Q-013 vẫn cần duyệt.
- **Bối cảnh:** audit phát hiện hash chưa nêu target route, key hold chỉ ở useRef không sống qua reload, trang duyệt refund thiếu danh sách và mock staging mâu thuẫn giới hạn dev/test.
- **Quyết định kỹ thuật:** giữ scope actor/operation/key; hash toàn bộ request đã validate gồm target và body. Khôi phục hold chưa rõ kết quả bằng metadata tối thiểu trong sessionStorage và replay đúng request/key; không persist credential. Giữ transaction/state machine/schema hiện tại. Ánh xạ availability phục vụ UI tại service, không thêm state DB.
- **Hợp đồng đề xuất có điều kiện:** nếu giữ refund, dùng collection API tối thiểu với quyền/phạm vi duyệt; nếu cho staging chạy mock, dùng endpoint hiện có với allowlist backend, phiên/ownership/provider checks và cấm production. Chi tiết ở [09](09-api-design.md), [14](14-environment-deployment.md), [18](18-open-questions.md), [22](22-frontend-architecture.md).
- **Lý do:** sửa trực tiếp các khoảng trống của luồng đã có, không thêm service, bảng hoặc hạ tầng mới.
- **Thay thế:** hash chỉ body gây nhập nhằng target; chỉ useRef mất key khi reload; endpoint lookup theo key thêm API không cần thiết khi replay còn hiệu lực; mở mock cho mọi user không phù hợp giới hạn demo; dùng audit log làm hàng đợi refund không có hợp đồng review rõ.
- **Đánh đổi/hệ quả:** recovery chỉ bảo đảm trong cùng tab khi metadata còn và nằm trong retention; storage không cấp quyền và phải được kiểm tra/xóa theo actor. Chính sách staging/refund chưa duyệt không được tự bật. T-027–T-031 kiểm chứng các hợp đồng khi có ứng dụng.

## ADR-001 — Modular Monolith theo module và tầng

- **Trạng thái:** đã xác định.
- **Bối cảnh:** dự án cá nhân cần transaction giữa booking, ghế, payment, vé; chưa có nhu cầu deploy riêng từng dịch vụ.
- **Quyết định:** một backend Express, module theo nghiệp vụ, controller/service/repository.
- **Lý do:** giảm chi phí vận hành, giữ transaction trong một DB, dễ đọc và test.
- **Thay thế:** microservices hoặc một codebase không phân module.
- **Đánh đổi/hệ quả:** phải giữ ranh giới bằng quy ước/review; scale/deploy toàn backend; có thể tách sau khi xuất hiện nhu cầu rõ ràng. Không thêm broker chỉ để mô phỏng microservices.

## ADR-002 — PostgreSQL là nguồn sự thật

- **Trạng thái:** Accepted; cập nhật bởi ADR-019 khi chuyển implementation từ MySQL sang PostgreSQL.
- **Bối cảnh:** dữ liệu quan hệ và yêu cầu không bán trùng, giữ lịch sử, đối soát tiền.
- **Quyết định:** quan hệ hướng 3NF, FK/UQ/CHECK và transaction PostgreSQL; giá snapshot là denormalization có chủ đích.
- **Lý do:** kiểm soát nhất quán dữ liệu tại DB và có row locking.
- **Thay thế:** MySQL/MariaDB có khả năng tương tự; document DB cần cách mô hình hóa/ràng buộc khác.
- **Đánh đổi/hệ quả:** migration và index phải được quản lý; không scale ghi vô hạn; phiên bản và query layer cần Q-016. Không đổi DB ngoài stack đã giao.

## ADR-003 — JWT access và refresh opaque có rotation

- **Trạng thái:** JWT đã xác định; quản lý phiên đề xuất.
- **Bối cảnh:** SPA cần phiên nhiều thiết bị, logout/khóa có hiệu lực và giảm lộ token.
- **Quyết định:** access token memory, refresh cookie HttpOnly/Secure; DB hash refresh và AuthSession; kiểm tra session/authVersion mỗi request riêng tư.
- **Lý do:** cân bằng API bearer với thu hồi tức thời, không lưu token trong web storage.
- **Thay thế:** server session cookie đơn giản hơn; JWT hoàn toàn stateless ít query nhưng khó thu hồi tức thời; JWT refresh không cần thiết.
- **Đánh đổi/hệ quả:** thêm DB read và CSRF protection ở cookie endpoint; rotation nghiêm ngặt có thể yêu cầu login lại nếu response refresh bị mất; TTL/MFA theo Q-006.

## ADR-004 — Khóa bi quan trên SessionSeat, transaction ngắn

- **Trạng thái:** đề xuất kỹ thuật.
- **Bối cảnh:** nhiều khách giữ cùng ghế; nhóm ghế phải thành công toàn bộ; callback/expiry có thể chạy cùng lúc.
- **Quyết định:** pre-create session-seat, UQ `(session_id,seat_id)`, READ COMMITTED + FOR UPDATE; parent SHARE locks và thứ tự khóa ở [11](11-booking-concurrency.md).
- **Lý do:** quyền phân bổ được quyết định dưới khóa, kiểm chứng được trên PostgreSQL thật; khóa ghế khác nhau cho phép xử lý đồng thời.
- **Thay thế:** optimistic version/conditional update, khóa cả session, Redis lock, isolation SERIALIZABLE.
- **Đánh đổi/hệ quả:** ghế nóng gây chờ, deadlock vẫn phải retry; cleanup phải khóa aggregate trước ghế; không giữ transaction trong hold TTL. Khóa cả session dễ hơn nhưng giảm throughput cả những ghế không giao nhau; Redis thêm rủi ro nhiều nguồn sự thật.

## ADR-005 — SeatHold tách Booking, xác nhận và tạo vé nguyên tử

- **Trạng thái:** đề xuất, một suất/đơn và TTL cần Q-001/Q-007.
- **Bối cảnh:** giữ trước checkout không nhất thiết tạo đơn; trạng thái PAID chưa phát vé làm tăng recovery path.
- **Quyết định:** SeatHold ACTIVE/CONVERTED/RELEASED/EXPIRED; Booking AWAITING_PAYMENT/CONFIRMED/CANCELLED/EXPIRED/REFUNDED; payment hợp lệ xác nhận + Ticket rows cùng transaction.
- **Lý do:** vòng đời gọn, expiry rõ, không có khoảng trống đã xác nhận nhưng thiếu ticket row.
- **Thay thế:** tạo booking ngay khi chọn ghế; thêm PAID và worker phát vé.
- **Đánh đổi/hệ quả:** thêm bảng hold/item; phát vé phải nhẹ và trong DB; render ảnh/PDF/email nằm ngoài transaction. Nếu ticket issuance trở nên nặng phải ADR lại.

## ADR-006 — Payment adapter, inbox/outbox và idempotency PostgreSQL

- **Trạng thái:** đề xuất kỹ thuật; payment mock MVP đã xác định.
- **Bối cảnh:** webhook lặp, timeout chưa rõ kết quả, process có thể chết trước/sau gọi mạng.
- **Quyết định:** interface adapter mock/real; attempt/provider key bền vững, inbox dedupe callback; outbox công việc sau commit với lease/retry.
- **Lý do:** core nghiệp vụ không phụ thuộc provider; không mất công việc khi process restart; không cần RabbitMQ ngay.
- **Thay thế:** gọi mạng trong transaction; queue ngoài DB không outbox; timer trong RAM; broker từ đầu.
- **Đánh đổi/hệ quả:** thêm bảng và worker polling, chấp nhận at-least-once và độ trễ; consumer phải idempotent, không hứa exactly-once qua mạng. Cần job đối soát khi outcome không rõ.

## ADR-007 — QR opaque, check-in online một lần

- **Trạng thái:** đề xuất; cửa sổ/người quét theo Q-008.
- **Bối cảnh:** cần vé khó đoán, thu hồi được và chống quét hai lần trên nhiều thiết bị.
- **Quyết định:** token QR ngẫu nhiên entropy cao, lookup bằng hash; ciphertext mã hóa để chủ vé xem lại; check-in kiểm tra DB và chuyển VALID → USED nguyên tử.
- **Lý do:** QR không chứa PII, trạng thái thu hồi có hiệu lực ở lần quét online tiếp theo.
- **Thay thế:** signed token tái dựng không cần ciphertext; QR chứa ID tuần tự; check-in offline.
- **Đánh đổi/hệ quả:** phải quản lý encryption key và kết nối khi quét; ảnh bị sao chép vẫn có thể bị dùng trước chủ vé, một lần quét không chứng minh danh tính. Offline/check tên/chuyển nhượng cần chính sách khác.

## ADR-008 — Monorepo web/API, REST có phiên bản

- **Trạng thái:** stack/REST đã xác định; layout đề xuất.
- **Bối cảnh:** một người phát triển cả hai phía, cần hợp đồng dễ review.
- **Quyết định:** Fe và BE trong một repo, API `/api/v1`, schema DTO rõ, ID/tiền chuỗi.
- **Lý do:** thay đổi contract/frontend/backend cùng một PR; tránh mất chính xác BIGINT.
- **Thay thế:** hai repo độc lập; GraphQL; một thư mục trộn frontend/backend.
- **Đánh đổi/hệ quả:** CI cần chạy theo phạm vi nhưng không bỏ test contract; phải tránh chia sẻ entity chứa bí mật sang client; package manager cần Q-016.

## ADR-009 — Main và nhánh công việc ngắn

- **Trạng thái:** đề xuất, repo local khởi tạo main.
- **Bối cảnh:** dự án cá nhân chưa cần nhiều dòng phát hành song song.
- **Quyết định:** main + feature/fix/Docs/refactor/chore, Conventional Commits.
- **Lý do:** lịch sử đơn giản, review nhỏ và tránh chi phí merge nhiều nhánh dài.
- **Thay thế:** GitFlow với develop/release/hotfix hoặc commit trực tiếp mọi thay đổi vào main.
- **Đánh đổi/hệ quả:** cần kỷ luật kiểm tra trước merge; thêm release strategy khi nhu cầu thật xuất hiện; remote/protection cần Q-017.

## ADR-010 — Chưa thêm realtime, Redis, search engine hoặc AI vào MVP

- **Trạng thái:** nguyên tắc tối giản đã xác định; thứ tự triển khai đề xuất.
- **Bối cảnh:** rủi ro lớn nhất hiện tại là tính đúng và bảo mật, chưa có số liệu chứng minh cần hạ tầng bổ sung.
- **Quyết định:** PostgreSQL search + API refresh ở MVP; công nghệ bổ sung qua phase sau có đo lường.
- **Lý do:** tập trung ngân sách phát triển vào transaction, kiểm thử và vận hành cơ bản.
- **Thay thế:** thêm Socket.IO/Redis/Elasticsearch/LLM ngay từ đầu.
- **Đánh đổi/hệ quả:** UI ghế có thể trễ và SQL search hạn chế ngôn ngữ; API phải xử lý 409 tốt. Khi có nhu cầu mới, tạo ADR thay thế dựa trên metric/use case, không dựa trào lưu.

## ADR-011 — Ràng buộc vật lý và khả năng phục hồi giao dịch

- **Trạng thái:** đề xuất kỹ thuật theo yêu cầu thiết kế SQL; không chốt policy Q-004/Q-007/Q-008/Q-009 hoặc phiên bản production Q-016.
- **Bối cảnh:** chuyển mô hình logic thành DDL phát hiện cần bảo vệ scope liên bảng, ngăn hai vé hiện hành, lưu đủ dữ liệu callback và không mất dấu tiền bất thường.
- **Quyết định:** thêm composite FK scope session/customer, Ticket.active_seat_guard, Booking.confirmed_payment_id; giữ pending guard nhưng bỏ đề xuất successful_booking_guard. Inbox lưu normalized payload đã lọc; outbox có lease token; QR có key version. DDL riêng cho database thử rỗng, ERD sinh từ SQL.
- **Lý do:** DB chặn nhầm phạm vi ngay khi ghi; khoản thực nhận luôn lưu được để đối soát; worker có dữ liệu phục hồi và không ack lease đã bị người khác lấy.
- **Thay thế:** chỉ kiểm tra scope/duplicate ticket trong service; unique mọi receipt thành công theo booking và cách ly khoản thừa ở inbox; inbox chỉ giữ hash; lease chỉ dùng deadline.
- **Đánh đổi/hệ quả:** thêm cột lặp/index được FK bảo vệ, thêm nhánh reconciliation; DB vẫn không kiểm tra được toàn bộ nghiệp vụ liên bảng hoặc lịch sử state transition. API chỉ xác nhận đơn một lần dưới khóa; nhiều receipt không đồng nghĩa cấp nhiều vé. Thay đổi chi tiết ở [20](20-physical-sql-design.md); dữ liệu/chính sách thật cần review trước migration.

## ADR-013 — Tổ chức, Google/OTP, review có hạn và layout tự thiết kế

- **Trạng thái:** yêu cầu nghiệp vụ đã xác nhận bởi chủ dự án ngày 2026-09-12, gồm câu trả lời làm rõ trong cùng hội thoại. Thiết kế kỹ thuật Markdown đã cập nhật. SQL/ERD được hoàn tất tiếp tại ADR-014; app chưa triển khai.
- **Bối cảnh:** Organizer phải là tổ chức, Admin duyệt role và event, không vận hành thay Organizer; khách dùng Google/OTP và check-in kiểu sân bay; venue có catalog/giới hạn nhưng layout do Organizer tạo.
- **Quyết định:** User đại diện Organization bằng membership được Admin duyệt và email công ty xác minh; Customer Google/phone OTP, công ty Google Workspace hoặc email OTP, session đa thiết bị. Organization sở hữu event/layout, venue là catalog chung.
- **Review:** gửi ít nhất một tháng lịch trước session sớm nhất; EventReview 15 ngày; chỉ Admin approve đúng bản còn hạn mới PUBLISHED. Expiry hủy hồ sơ, gửi notification tự động và tạo việc soạn phiếu; Admin dùng form để soạn/gửi lý do thật. Không tự approve, không biến hủy hồ sơ thành hủy vé đã bán.
- **Vé:** TicketType code riêng và mã từng Ticket riêng; attendee snapshot mỗi BookingItem. Self check-in mở 24h trước startsAt hoặc xác nhận tại quầy tạo CheckIn, Ticket vẫn VALID; admission mới USED. Không thu số thẻ ngân hàng/giấy tờ.
- **Editor:** React/SVG 2D, hình học có schema, ghế quan hệ ID ổn định, kiểm tra bounds/capacity/collision ở server; frozen layout version đúng event/venue trước review/bán. Không cần SaaS, 3D hoặc infrastructure mới.
- **Quyền vận hành:** Organizer xử lý refund thường xuyên; Admin cần report đúng scope cho can thiệp khác ngoài duyệt role/event. Audit không thay ownership/report validation.
- **Thay thế:** ADR-003 bỏ login mật khẩu nhưng giữ app JWT/refresh/session; ADR-007 tách CheckIn khỏi admission; ADR-011/DDL/ERD là baseline cần mở rộng scope mới; ADR-012 giữ canonical request/recovery nhưng danh sách refund thường xuyên chuyển Organizer. Đề xuất venue riêng và tự publish trong các Q cũ đã bị thay.
- **Giữ nguyên:** modular monolith, PostgreSQL, transactions, row locks, idempotency, atomic ticket issuance, outbox và failure recovery. QR vẫn opaque; code nhập tay có thể là cùng secret ở dạng biểu diễn khác.
- **Đánh đổi:** thêm bảng/flow vì yêu cầu cụ thể của chủ dự án; editor/review/OTP/notification là MVP có thêm công việc, không giữ kết luận scope cũ để bỏ chúng. Không cần chuyển microservices hoặc thêm broker.
- **Kiểm chứng:** T-032–T-041 và baseline tests còn liên quan; đồng bộ DDL/ERD/seed/query theo [20](20-physical-sql-design.md) trước implementation. Thông số chưa có giá trị cụ thể ở Q-003/Q-004/Q-009/Q-012/... vẫn không tự suy diễn.

## ADR-014 — Đồng bộ SQL vật lý theo quyết định chủ dự án

- **Trạng thái:** chấp nhận thiết kế; DDL/seed/query/ERD/SVG hoàn tất ngày 2026-09-13, chưa phải migration production hay ứng dụng chạy được.
- **Vấn đề:** baseline 27 bảng còn Organizer cá nhân, venue sở hữu riêng, password và check-in đồng nghĩa vào cửa, trái ADR-013.
- **Quyết định:** 38 bảng theo [20](20-physical-sql-design.md). Identity provider/subject, OTP MAC/binding, Organization/Membership với company identity, EventReview/ReasonNotice/Notification/SupportReport, layout catalog snapshots, TicketType, ReservationQuota, CheckIn riêng. Seed 29 permission theo ma trận 03, không cấp UserRole.
- **Scope FK:** identity đúng người/provider; layout đúng tổ chức/event/venue; ghế và type đúng session/layout; booking đúng hold/customer/session/event; report booking đúng event. Event published trỏ bản APPROVED bằng composite FK, USED trỏ CheckIn của chính vé. Các snapshot/version hiện hành và quyền người thao tác vẫn cần service kiểm tra dưới khóa.
- **Credential:** một secret vé dùng chung mã nhập tay và QR, hash/ciphertext/key-version; bỏ hai tập QR/ticket credential trùng chức năng. Không lưu dữ liệu thẻ ngân hàng hay giấy tờ.
- **Thời gian:** CHECK review hạn đúng 15×24h và quyết định trước expiry; cutoff một tháng lịch có timezone/clamp do service tính, không tin client. Online check-in T-24h và các window do service áp dụng. Counter đóng không sau admission đóng; admission đóng không sau ends_at.
- **Giữ nguyên:** generated guard tiền/vé, một confirmed_payment_id, ghi nhận mọi receipt và reconciliation, outbox fencing, lịch sử không cascade xóa. Không triggers tự publish/expire hoặc gửi mạng từ DB.
- **Kiểm chứng lịch sử:** 67 kiểm tra của ADR-014 đã chạy trên MySQL 8.0.46 trước khi ADR-019 chuyển runtime sang PostgreSQL. Kết quả đó không thay kiểm thử concurrency PostgreSQL cần bổ sung. DDL PostgreSQL hiện đã được kiểm tra riêng theo ADR-019.
- **Hệ quả:** backend cần triển khai scope, immutable snapshots, quota, geometry, calendar cutoff, form Admin, notification/expiry transactions theo 21/23; lựa chọn currency/hạ tầng còn mở theo 18. DDL chỉ cho database rỗng, dữ liệu cũ cần migration riêng.

## ADR-015 — Khung BE/FE và môi trường phát triển

- **Trạng thái:** triển khai khung theo yêu cầu chủ dự án; bố cục `BE/`, `Fe/`, `Docs/`, `database/` được chủ dự án chỉ định trong hội thoại.
- **Lựa chọn:** npm workspaces, Node 24.21.0 cài portable riêng trên Windows, npm 11.19.0; Express 5, React/Vite, React Router, TypeScript 5.9 strict, pg không ORM, Zod, Pino, Helmet/rate limit, ESLint 10, Prettier, Vitest/Supertest. Dependency pin và lockfile được lưu; không đổi Node toàn máy.
- **Ranh giới:** health endpoints hoạt động; các module nghiệp vụ mới có thư mục. Không tạo auth/payment/worker/migration giả. Public FE hiện gọi cùng origin qua proxy; không mở CORS wildcard. FE dev filesystem không được đọc BE, envDir chỉ Fe. DB chỉ kiểm tra SELECT 1; không đổi schema/grants hoặc dữ liệu có sẵn. Topology Admin frontend được chốt sau tại ADR-016.
- **Bí mật:** BE/.env riêng máy, Git ignore và ACL Windows; mẫu không chứa credentials thật. Keys dự phòng được tạo bằng crypto, chưa dùng để tuyên bố auth hoạt động. Không log raw DB errors/env/headers/body/query string. Secret guard và CI là lớp bổ sung, không thay secret manager production.
- **Kiểm chứng:** 7 test HTTP/config, lint, typecheck, build, format; lần kiểm tra database ở ADR-015 là kết quả lịch sử trước ADR-019. Bộ 67 kiểm tra trước đây độc lập và không phải test nghiệp vụ ứng dụng mới.
- **Còn lại:** migration runner, Google/SMS/email/payment integration và nghiệp vụ theo roadmap; các biến chưa được parser tiêu thụ vẫn là hợp đồng tương lai. Runtime/tool dependencies được giữ theo yêu cầu setup; helper và process kiểm thử được dọn.

## ADR-016 — Customer/Organizer chung frontend, Admin tách frontend

**Superseded trong phần hai frontend bởi ADR-028 ngày 2026-10-11; dùng một Fe/ với ba khu vực.**

- **Trạng thái:** đã xác định theo yêu cầu chủ dự án ngày 2026-09-23.
- **Bối cảnh:** Customer cần trải nghiệm public/mua vé; Organizer dùng cùng tài khoản và nền tảng nhưng cần workspace quản lý sự kiện chuyên biệt. Admin có phạm vi vận hành, dữ liệu và rủi ro khác, cần giao diện và bề mặt triển khai riêng. Cả ba vai trò vẫn dùng cùng nghiệp vụ backend.
- **Quyết định:** `Fe/` là một ứng dụng/server cho Guest, Customer và Organizer. Organizer có `OrganizerLayout` và route riêng trong `Fe/`; không tạo frontend Organizer độc lập. `AdminFe/` là ứng dụng/build/server/origin độc lập và không nằm trong bundle `Fe/`. Cả hai frontend gọi duy nhất `BE/` qua `/api/v1`; backend/worker/PostgreSQL vẫn là modular monolith và nguồn sự thật chung.
- **Biên bảo mật:** tách origin Admin giảm bề mặt UI nhưng không cấp quyền. Backend xác thực role/permission/scope trên từng request và audit thao tác Admin. Ưu tiên reverse proxy `/api/v1` cùng origin cho từng portal với session host-only; nếu cross-origin thì allowlist chính xác hai origin, không dùng `*` với credentials và kiểm thử CSRF/CORS.
- **Hệ quả:** CI/CD tạo artifact Public Web, Admin Web và Backend/worker riêng; deploy Admin không buộc phát hành lại Public Web nếu API contract tương thích. Không import page/router Admin vào `Fe/`; không dựng API hoặc DB riêng cho Admin. Các DTO dùng chung phải đến từ OpenAPI/schema hoặc package contract không chứa UI/runtime/DB entity.

## ADR-017 — Catalog public dùng PostgreSQL và API thay fixture frontend

- **Ngày:** 2026-09-23
- **Trạng thái:** Accepted, phần đọc catalog đã triển khai
- **Bối cảnh:** Home, preview và page chi tiết từng đọc nhiều fixture TypeScript trùng lặp. Quan hệ event/organizer/merchandise/bài viết bị ghép bằng tên hiển thị, còn UI “Resale tickets” mô phỏng marketplace cá nhân trái với nghiệp vụ mở bán lại của Organizer trong tài liệu 23.
- **Quyết định:** thêm sáu bảng `organization_profiles`, `event_publications`, `city_profiles`, `merchandise_products`, `blog_articles`, `event_change_requests`. `BE/modules/catalog` cung cấp API đọc công khai; `Fe/features/catalog` tải và validate một graph dùng chung. Event chỉ công khai khi `events.status=PUBLISHED`; hồ sơ mở bán chỉ hiện khi `APPROVED` và `visible_on_catalog=TRUE`. ID và tiền trả về dạng chuỗi; giá catalog không thay giá tồn kho lúc checkout.
- **Migration:** database 38 bảng ADR-014 dùng `database/migrations/001-public-catalog.sql`; database mới dùng `schema.sql`. `seeds/002-public-catalog.sql` chỉ dành cho local/demo và giữ quan hệ FK thật.
- **Hệ quả:** xóa các file mock/catalog cục bộ đã được thay thế. Auth, booking, payment và mutation Organizer không được giả lập; chúng tiếp tục theo API contract và yêu cầu authorization backend.
- **Tham khảo giao diện:** workspace Organizer có thể học cách nhóm tác vụ từ Ticketbox Organizer (thông tin sự kiện, thời gian/loại vé, cài đặt, thông tin thanh toán), nhưng không sao chép nội dung pháp lý/nhận diện và không dùng hành vi của trang tham khảo thay hợp đồng nghiệp vụ trong Docs.

## ADR-018 — Backend và Frontend là hai package npm độc lập

- **Ngày:** 2026-09-24
- **Trạng thái:** Accepted, đã triển khai
- **Bối cảnh:** npm workspaces hoist phần lớn dependency vào `node_modules` ở gốc, trong khi quy trình vận hành yêu cầu vào `BE/` để cài/chạy Backend và vào `Fe/` để cài/chạy Frontend. FE còn kế thừa TypeScript/ESLint và runtime helper từ BE nên chưa độc lập thật sự.
- **Quyết định:** bỏ package.json, package-lock.json và node_modules ở gốc. `BE/` và `Fe/` tự giữ package.json, package-lock.json, node_modules, `.npmrc`, TypeScript, ESLint, Prettier, env setup và Node helper. CI chạy `npm ci` + `npm run check` riêng trong từng thư mục. FE chỉ cho Vite đọc filesystem bên trong `Fe/`.
- **Hệ quả:** mở hai terminal và chạy từng app; không còn lệnh npm tại gốc. Một số dev dependency được lặp giữa hai lockfile để đổi lấy khả năng cài/build/deploy độc lập và tránh resolution ngầm qua package khác. ADR-018 thay thế lựa chọn npm workspaces ở ADR-015; topology một Public Web và một Backend của ADR-016 không đổi.

## ADR-019 — PostgreSQL là database runtime và DBeaver là công cụ SQL local

- **Ngày:** 2026-09-24
- **Trạng thái:** Accepted, đã triển khai
- **Bối cảnh:** source trước đây dùng cú pháp MySQL và driver `mysql2`, trong khi môi trường database được chọn là PostgreSQL và cần chạy script trực tiếp bằng DBeaver.
- **Quyết định:** toàn bộ schema, migration, seed và query dùng PostgreSQL 16+; Backend dùng driver `pg`, port mặc định 5432, `TIMESTAMPTZ(6)`, `JSONB`, identity column, `ON CONFLICT` và tham số `$1`. Script SQL không chứa tên database cố định; người vận hành chọn database trong DBeaver trước khi chạy.
- **Transaction:** Backend đặt timezone UTC và `lock_timeout` trên connection. Transaction nghiệp vụ khai báo `READ COMMITTED`, dùng cùng một `PoolClient`, không tự retry khi kết quả COMMIT chưa rõ.
- **Kiểm chứng:** PostgreSQL 18 tạm đã tạo đủ 44 bảng, nạp seed hai lần liên tiếp, chạy bốn query mẫu và toàn bộ catalog repository. Migration catalog được kiểm tra riêng trên schema lõi tối thiểu.
- **Hệ quả:** ADR và đoạn tài liệu cũ đề cập MySQL được hiểu theo quyết định PostgreSQL này. Database MySQL cũ không được nâng cấp trực tiếp bằng các file hiện hành; nếu có dữ liệu thật phải có kế hoạch ETL riêng.

## ADR-020 — Google Authorization Code + PKCE cho đăng nhập đầu tiên

- **Ngày:** 2026-10-03
- **Trạng thái:** chủ dự án đã chọn luồng và phạm vi; code Google + JWT đã triển khai, chưa kiểm thử Google live.
- **Bối cảnh:** Docs/04 trước đây mô tả GIS credential đưa ID token từ frontend tới backend. Chủ dự án yêu cầu OAuth 2.0 + JWT và chọn Google Authorization Code + PKCE, làm Google + JWT trước OTP.
- **Quyết định:** backend tạo state/nonce/code verifier, FE chuyển trình duyệt tới Google, callback cùng origin đổi code bằng backend và xác minh ID token Google. Dùng `sub` làm định danh; tạo Customer khi đăng nhập lần đầu. Access JWT 10 phút chỉ ở memory; refresh opaque token chỉ ở cookie HttpOnly, hash trong PostgreSQL, hạn tuyệt đối 7 ngày và xoay mỗi lần dùng. API cookie kiểm tra Origin/CSRF; replay refresh cũ thu hồi session.
- **Lý do:** giữ Google client secret và code exchange ở backend; PKCE và state bảo vệ code/callback; phiên ứng dụng độc lập với Google token; PostgreSQL cho phép thu hồi theo thiết bị.
- **Thay thế đã cân nhắc:** tiếp tục GIS ID token trực tiếp; lưu refresh token ở frontend; thêm OTP cùng đợt khi chưa có provider.
- **Hệ quả:** cần OAuth Web client, redirect URI chính xác và HTTPS ngoài local. Callback đặt refresh cookie rồi redirect cố định về FE; FE gọi refresh để nhận access JWT, không đặt JWT trong URL. OTP, email công ty, linking và quyền Organizer/Admin tiếp tục theo 04/Q-006 ở đợt sau. Không tự cấp Organizer từ email hay Google `hd`. Xem [tiến độ auth](26-auth-progress.md).

## ADR-021 — Google OAuth và email OTP dùng chung User qua liên kết

- Ngày 2026-10-09, chủ dự án quyết định; trạng thái Accepted.
- Customer dùng Google PKCE hoặc email OTP qua SMTP Gmail App Password. SĐT là alias chưa xác minh để tra email, thay SMS Customer; không dùng alias làm proof khôi phục hay quyền.
- Google trước: login mới + OTP cùng email để link EMAIL; EMAIL trước: login mới + Google proof cùng email để link Google. Không auto merge/trùng User khi cùng email; identity thuộc User khác trả conflict. Linking trong 5 phút; JWT 10 phút, refresh 7 ngày tuyệt đối/rotation giữ nguyên.
- EMAIL/channel EMAIL tách COMPANY_EMAIL; thêm phone_login_aliases, otp_challenges.login_phone/delivery_ready. Database cũ dùng migration 002 sau backup/review, không tự áp dụng lên DB người dùng. Google users/sessions được giữ.
- Gmail cần 2-Step Verification, App Password và có quota; không có OTP Google cấp sẵn. ADR-020 tiếp tục cho Google/phiên, phần hoãn OTP Customer/linking được thay thế. Email công ty/Organizer và vận hành production còn mở.

## ADR-022 — Ảnh trên R2 và client upload bằng presigned URL

- **Ngày:** 2026-10-10; chủ dự án chọn cả ảnh cá nhân và event/merchandise, JPEG/PNG/WebP tối đa 5 MB, URL 5 phút.
- **Quyết định:** BE dùng AWS SDK ký PUT tới R2; client gửi trực tiếp File, không proxy binary qua BE hoặc lưu binary/base64 trong PostgreSQL. DB chỉ lưu URL đã được BE xác minh. Giữ hỗ trợ các tên cấu hình `R3_*` chủ dự án đã điền, chuẩn hóa sang R2 trong code; bí mật ngoài Git.
- **Quyền:** avatar của chính User với profile.update_self; event/product với event.update_own, company session, membership ACTIVE, Organization APPROVED và ownership/version. Chỉ bản nháp; không bỏ qua review hoặc tự cấp Organizer từ login Customer/domain. Phiên auth/JWT/refresh/cookie/CSRF giữ nguyên.
- **Bảo vệ:** key ngẫu nhiên do BE sinh, ký Content-Type/Content-Length/If-None-Match, receipt ràng buộc actor/session/target 5 phút; complete kiểm tra HEAD/signature ảnh và revalidate dưới khóa trước lưu URL/audit. Không giữ transaction khi gọi R2. CORS allowlist của bucket bắt buộc cho browser.
- **Migration:** 003 thêm users.avatar_url và events.cover_image_url nullable; merchandise_products.image_url hiện có. Catalog fallback publication URL cũ. Không thay seed ảnh cũ hoặc tự tải ảnh từ URL bên ngoài.
- **Kiểm chứng/giới hạn:** API/DB/R2 live đã kiểm tra trên DB riêng; upload UI avatar và component dùng chung đã có. Chủ dự án cấu hình CORS trên dashboard; OPTIONS 204 và Edge upload File PUT 200/hiển thị ảnh public đã qua. Editor/company login Organizer chưa tồn tại. Xem [28](28-r2-image-upload.md) cho kết quả và giới hạn kiểm chứng.

## ADR-023 — Hồ sơ, follow notification, tuổi và CCCD mỗi vé

- Ngày 2026-10-11; chủ dự án chốt Q-024, Accepted. Gender/DOB nullable, riêng tư, không lưu age cố định. Customer theo dõi Organization, notification trong web khi event được duyệt/công khai; có danh sách và mute riêng, chưa email/push.
- Deferred DB trigger enqueue outbox từ trạng thái PUBLISHED + publication cuối transaction, unique event key. Worker thuần PostgreSQL fan-out 500 User mỗi transaction với cursor/SKIP LOCKED và unique recipient/type/event; không network trong transaction. Giữ luồng review inbox cũ, không tạo API Organizer tự publish hoặc suy role từ email.
- Event minimum_age nullable và age_tag generated; tuổi theo ngày suất trong timezone venue, kiểm tra mỗi người tham dự. Không sửa age policy của PUBLISHED qua endpoint nháp.
- Chủ dự án thay phạm vi cũ không thu giấy tờ: mỗi vé có họ tên/DOB/SĐT/CCCD riêng; thông tin tự khai, staff đúng tổ chức đối chiếu giấy tờ thật tại cửa. Không nhận ảnh giấy tờ hoặc thêm provider xác minh online. CCCD AES-GCM/HMAC bằng key riêng ngoài Git; chỉ trả che số; purge mọi derivative CCCD 30 ngày sau ends_at, không xóa vé/giao dịch.
- Migration 004/005 và schema 47 bảng; giữ review constraints/dedupe, thêm follows/attendees và guard confirmation/USED. Tuân thủ khóa quota → event → session → booking → items ở cập nhật attendee.
- 64 kiểm tra DB riêng đã qua; backup/migration local và key riêng đã chuẩn bị. Worker phải chạy để dispatch/purge. FE, company login, checkout/payment/ticket issuance/admission end-to-end vẫn chưa có; xem [29](29-profile-follow-age-attendees.md).

## ADR-024 — Dùng lại BookingItem cho thông tin người tham dự (2026-10-11)

- Theo yêu cầu chủ dự án rà soát và xóa phần thừa, thay phần lưu attendee của ADR-023: BookingItem đã đại diện từng vé trước thanh toán và có attendee_name_snapshot. Gộp dữ liệu từ ticket_attendees vào BookingItem, không giữ bản full_name thứ hai hoặc bảng 1:1.
- DOB/SĐT attendee có prefix, độc lập với profile/alias của người mua. Giữ mã hóa, HMAC, masking, proof staff, retention và guard tuổi. API giữ hợp đồng; ageTag tính từ minimum_age, bỏ generated column.
- Migration 006 kiểm tra xung đột tên, copy dữ liệu trước DROP, trong transaction sau backup. Không sửa migration 004/005 đã áp dụng, không xóa lịch sử giao dịch. Schema mới 46 bảng.
- Trade-off: hàng booking_items rộng hơn và cần khóa item khi verify/purge; tránh join/ghi kép và hai nguồn tên không đồng nhất. Xem [rà soát](30-schema-consolidation.md).

## ADR-025 — Monolith trong giai đoạn phát triển; hỏi trước mọi thay đổi phân tán (2026-10-11)

- **Trạng thái:** Accepted. **Người quyết định:** chủ dự án, yêu cầu trực tiếp trong hội thoại ngày 2026-10-11.
- **Bối cảnh:** chủ dự án đang phát triển sản phẩm và yêu cầu gỡ load balancer; mục tiêu tải không phải sự đồng ý tự thêm hạ tầng phân tán.
- **Quyết định:** dùng Modular Monolith, một API instance; ưu tiên hoàn thiện chức năng và luồng sản phẩm. Mọi vấn đề/thay đổi liên quan distributed system phải hỏi chủ dự án trước khi triển khai hoặc dựng thử nghiệm/hạ tầng, nêu nhu cầu, lựa chọn, tác động/chi phí và chờ trả lời.
- **Phạm vi cần hỏi:** load balancer/nhiều instance, microservices, Kafka/RabbitMQ, cluster/replication/sharding, distributed lock/transaction và điều phối/mở rộng phân tán. Không tự triển khai các đề xuất cũ chỉ vì đã từng nêu hoặc benchmark.
- **Phạm vi hiện có:** Redis cho cache/rate limit/phòng chờ, R2 cho ảnh và worker cùng codebase tiếp tục theo phần đã được chấp thuận; không mặc nhiên mở rộng sang kiến trúc phân tán. Không thay quyết định auth hoặc transaction PostgreSQL.
- **Hệ quả:** giữ môi trường phát triển đơn giản; đánh giá mở rộng sau khi có nhu cầu đo được và quyết định riêng của chủ dự án. Quy tắc áp dụng cho mọi người/agent đến khi chủ dự án đổi rõ ràng; đã ghi vào AGENTS.md, PROJECT_RULES.md, README, Docs/10 và Q-025.

## ADR-026 — Chuẩn hóa cấu trúc BE và validation (2026-10-11)

- **Trạng thái:** Accepted trong phạm vi yêu cầu chủ dự án làm sạch toàn bộ BE, tìm phần dùng chung và bổ sung validation; FE để sau.
- **Bối cảnh:** routes chứa HTTP/schema/nghiệp vụ/SQL, auth/booking/catalog gộp nhiều trách nhiệm; module lấy primitive schema từ notifications; OpenAPI lớn và chứa contract sai module.
- **Quyết định:** routes lắp middleware/controller; controller validate/chuyển HTTP; service giữ use case/transaction; repository giữ SQL/connection; policy thuần riêng. Tách file theo trách nhiệm, dùng factory/entry point vừa đủ, không buộc mọi chức năng thành class hoặc thêm framework DI. Schema/actor/response/worker lifecycle/cache parser thật sự dùng chung nằm ở shared. Mỗi module sở hữu OpenAPI của mình.
- **Bố trí folder:** theo phản hồi trực tiếp tiếp theo của chủ dự án, gom thư mục con thay danh sách phẳng: auth theo google/otp/session/account, bookings theo holds/orders/allocation/inventory/waiting-room; module nhỏ theo tầng, events/tickets theo tính năng. Gốc module giữ entry point cần dùng; cập nhật import/test, không giữ shim từng file cũ. Cây folder ở Docs/31.
- **Validation:** kiểm tra ID BIGINT trước chuyển BigInt, version INTEGER, query scalar/allowlist/boolean và page có trần, body mutation strict. Mutation có body tuân thủ application/json, sai Content-Type trả 415 theo Docs/09; cache sai schema trở thành cache miss. Quy tắc nghiệp vụ/ownership/tuổi vẫn ở service và kiểm tra dưới khóa.
- **Giới hạn:** giữ Modular Monolith/một API instance; không thêm distributed system. Không đổi provider, linking, JWT/refresh/cookie/CSRF, schema DB hoặc triển khai chức năng mới. Worker notification/retention hiện có dùng runner chung, hai job xử lý lỗi riêng.
- **Trade-off:** số file tăng nhưng từng trách nhiệm nhỏ và dễ tìm; facade giữ caller ổn định. Không gộp query quyền khác scope/lock chỉ để giảm dòng. Kiểm tra HTTP/schema/dependency/OpenAPI và PostgreSQL riêng; xem [31](31-backend-code-structure.md) và [26](26-auth-progress.md).

## ADR-027 — Một kênh payOS, tách payment/booking và phát vé nguyên tử (2026-10-11)

- **Trạng thái:** Accepted; chủ dự án xác nhận một kênh payOS trong BE/.env, VND, tiền muộn cần đối soát và không hồi sinh vé. Yêu cầu SOLID/OOP, nối attendee → payment → ticket → admission → FE.
- PaymentService qua các port/gateway/issuer; Booking sở hữu allocation, Tickets sở hữu mã/entry. Constructor injection; SQL ở repository. Provider network ngoài transaction, dùng outbox/inbox đã có. Không thêm bảng/framework/broker/load balancer hoặc thay auth.
- Giá/đơn/owner/attendee/tuổi do BE xác minh. Chỉ nhận đủ đúng tiền khi đơn còn hạn mới phát vé cùng transaction confirmation. Callback trùng/idempotency không phát lại; thiếu/dư/muộn/đơn không khả dụng ghi đối soát. Không tự split/payout/refund.
- Check-in giữ VALID; admission đúng company/org/permission/cửa sổ và giấy tờ thật mới USED một lần. Key QR AES-GCM độc lập, không PII trong QR. Xem [32](32-payos-booking-ticket-flow.md).

## ADR-028 — Một FE với ba khu vực (2026-10-11)

- Accepted theo chấp thuận trực tiếp của chủ dự án: dùng một ứng dụng Fe/, Customer ở /, Organizer /organizer/*, Admin /admin/*, layout riêng và lazy chunks. Thay phần hai frontend server của ADR-016; không tạo AdminFe/.
- BE vẫn một Modular Monolith/API, kiểm tra role/permission/ownership; router/layout chỉ UX, không là ranh giới quyền. BE được ưu tiên, chưa dựng dashboard FE trong bước này.

## ADR-029 — Vai trò lúc onboarding, hồ sơ bắt buộc và gợi ý theo quy tắc (2026-10-11)

- **Accepted, chủ dự án quyết định.** Cơ chế email công ty của ADR-013/014/023 được thay trong phạm vi đăng ký/quyền Organizer; xác minh Google PKCE/email OTP, liên kết identity, JWT 10 phút, refresh 7 ngày/rotation, cookie, Origin/CSRF giữ nguyên.
- Tài khoản mới sau xác minh chưa có vai trò nghiệp vụ. Onboarding chọn CUSTOMER hoặc ORGANIZER; displayName/gender/DOB bắt buộc, có UNDISCLOSED cho giới tính. Chỉ allowlist hai vai trò, không tự đăng ký Admin. Organizer không nhận Customer; bật Customer qua hành động riêng, không tự chuyển vai trò qua PATCH profile.
- Organizer tạo Organization + membership PENDING và sự kiện nháp ngay. Admin vẫn duyệt Organization/membership và review event trước publication/inventory/check-in. Không lấy quyền từ email/domain hoặc frontend. Không cấp Admin thật, chỉ fixture trên PostgreSQL tạm.
- Dùng users hiện có cho registration_role/completion/preferences; không thêm bảng onboarding. Rename metadata company → applicant/member/contact để dùng personal EMAIL/GOOGLE, giữ identity FK và lịch sử; không tự merge hoặc xóa identity/role/giao dịch trong migration.
- Tài khoản cũ cần hoàn tất lựa chọn. Chọn Organizer chỉ bỏ vai trò Customer mặc định cũ granted_by NULL, giữ vai trò cấp tường minh/lịch sử; từ chối khi còn lượt hold/đơn chờ tiền hiệu lực. Bật Customer sau là hành động rõ ràng.
- Category/city/approved Organizer follow tùy chọn; follow notification dành cho Customer, Organizer theo dõi chỉ phục vụ sở thích. Gợi ý RULES_V1: followed +40, category +30, city +20, sắp diễn ra +0..20, popularity +0..10; mỗi vị trí thứ tư lấy khám phá, không trùng/past/unpublished. Không AI/ML.
- Trade-off: onboarding cần migration/hồ sơ trước lượt mua mới; quyền Organizer đăng ký không đồng nghĩa được mở bán. Metadata role/preference riêng với role grants và snapshot attendee/ticket. Chi tiết ở Docs/33 và Docs/34.

## ADR-030 — Câu hỏi bổ sung do Admin quản lý (2026-10-12)

- Accepted theo chủ dự án: giữ bốn trường lõi bắt buộc, Admin thêm/bỏ/sắp xếp/sửa nhãn/required câu bổ sung. Quyền onboarding.manage chỉ ADMIN; không gán quyền từ câu trả lời custom.
- Bộ câu hỏi xuất bản có phiên bản bất biến, một ACTIVE; Admin dùng optimistic questionnaireId và idempotency, audit metadata. Người chưa hoàn tất phải gửi phiên bản hiện hành, mismatch trả409 trước role grant. Người đã hoàn tất giữ phiên bản/câu trả lời, không bị ép onboarding lại.
- DB local metadata46 bảng, không có bảng cấu hình form phù hợp. Thêm onboarding_questionnaires cho vòng đời dùng chung/archived độc lập User; custom answers và FK nằm trong Users, không bảng answers1:1 và không copy category/city/follow. Migration010, fresh47 bảng, local chưa apply.
- Trade-off: thêm một thực thể cấu hình/lịch sử và kiểm tra version, tránh câu trả lời đổi nghĩa hoặc mất dữ liệu khi Admin bỏ câu hỏi. Không AI/distributed changes; auth/ticket/payment không đổi. Chi tiết Docs/35.

### ADR-031 — Gộp hai extension catalog vào bảng cha — ACCEPTED 2026-10-12

- **Chủ dự án:** yêu cầu gộp và áp dụng ngay DB sau báo cáo36.
- **Quyết định:** organization_profiles → organizations; event_publications → events. Hai quan hệ0..1 không có lịch sử nhiều phiên bản riêng. Metadata công khai nullable nhưng CHECK nguyên bộ; giữ unique public IDs/ranks, ảnh nháp và ảnh công bố/timestamp riêng. DTO công khai vẫn chỉ SELECT field được phép.
- **Thực hiện:** migration011 transactional/lock/copy/EXCEPT/DROP không CASCADE, giữ dữ liệu/FK và deferred outbox hook. Không sửa migration đã áp dụng; schema/seed/query/readiness đã cập nhật. Apply008–011 DB local sau backup, không cấp Admin thật.
- **Bằng chứng:** DB local/fresh45 bảng,12 profile/13 publication/ảnh được giữ; hash lịch sử credential/role assignment/tiền/vé/audit/outbox không đổi. Fresh/populated upgrade khớp; PG/Edge25 ca qua. Hoàn tác bằng backup + app release tương ứng, không drop lịch sử mới để rollback. Không mở rộng distributed system.

### ADR-032 — Hoàn tiền thủ công và feedback riêng tư — ACCEPTED 2026-10-12

- **Chủ dự án:** chốt yêu cầu trước suất ít nhất24 giờ; sao1–5 sau suất/khi hủy, sửa7 ngày; đánh giá tổ chức cho người gửi/Organizer/Admin, góp ý web cho người gửi/Admin.
- **Quyết định:** full refund chưa USED, Organizer duyệt; Admin phải report đang được giao đúng booking/event. Duyệt thu hồi vé nguyên tử; kết quả chuyển tiền ghi thủ công có reference/evidence/time/actor, không gọi payOS refund. Không resale hoặc hồi sinh vé khi thất bại. Receipt sau refund giữ REFUNDED và đối soát.
- **Dữ liệu:** dùng lại refunds/support_reports; một feedback chung SYSTEM/ORGANIZATION với CHECK/FK/unique và history/version. Không tái dùng event_reviews (hồ sơ duyệt) hoặc biến góp ý app thành report cấp quyền giao dịch. Private DTO/audit metadata, không public review hoặc tự tính uy tín để duyệt tổ chức.
- **Kiến trúc:** RefundService phụ thuộc booking/payment ports và adapter trong module sở hữu; PostgreSQL transaction theo giao thức khóa, idempotency hiện có. Monolith, không broker/hạ tầng/auth provider mới.
- **Triển khai:** migration012 đã áp dụng DB local sau backup và kiểm thử fresh/populated upgrade;46 bảng. Không cấp Admin thật hoặc chuyển/hoàn tiền thật. FE mới chưa nối. [Hợp đồng và bằng chứng](37-refunds-reviews-app-feedback.md).
