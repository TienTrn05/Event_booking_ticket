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
