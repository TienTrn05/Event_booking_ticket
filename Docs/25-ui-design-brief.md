# 25. Brief và prompt thiết kế UI

**Hướng màu mới theo chủ dự án:** Light gợi biển xanh, Dark gợi vũ trụ, dùng cùng semantic tokens/component. Phương án xanh ngọc A bên dưới là đề xuất cũ; bản FE hiện dùng xanh biển ở light và nền navy/cyan với tím ở dark. Hệ theme và giới hạn triển khai ghi ở [22](22-frontend-architecture.md). Tham khảo cấu trúc Home public của chủ dự án tại https://event-ticketing-plat-d2vs.bolt.host; không giữ các mô tả bán lại giữa khách, nghệ sĩ đồng nhất Organizer hoặc số liệu quảng cáo chưa có căn cứ trong bản dựng.

Phần 10 bổ sung prompt merchandise và tên hiển thị nghệ sĩ/chương trình. Gửi cả phần này cùng prompt tổng, không chỉ dùng luồng mua vé cũ để thiết kế hàng hóa.

> **Cập nhật:** nghiệp vụ thay đổi/mở bán lại, hủy sự kiện, feedback có sao và điểm uy tín nằm trong [23, phần 9](23-organization-review-seatmap.md#9-thay-đổi-sự-kiện-feedback-và-uy-tín-tổ-chức). Tăng sức chứa chỉ là một ví dụ. Dùng phần 9 của brief này cùng prompt tổng khi giao thiết kế.

Tài liệu để giao cho chuyên gia UI/UX hoặc dùng làm đầu vào công cụ thiết kế. Đầu ra mong muốn là **bản thiết kế Figma có thể chỉnh sửa và prototype**, chưa phải frontend đã triển khai. Các lựa chọn hình ảnh dưới đây là đề xuất, không thay đổi nghiệp vụ đã chốt.

Nguồn đối chiếu: [vai trò](03-user-roles-permissions.md), [xác thực](04-authentication-authorization.md), [luồng người dùng](05-user-flows.md), [quyết định còn mở](18-open-questions.md), [kiến trúc FE](22-frontend-architecture.md), [tổ chức, duyệt và sơ đồ ghế](23-organization-review-seatmap.md). Khi giao cho chuyên gia ngoài repository, gửi kèm các tài liệu này; đường dẫn tương đối trong file không tự cung cấp nội dung cho họ.

## 1. Các hướng thiết kế

| Lựa chọn | Đặc điểm | Phù hợp khi |
| --- | --- | --- |
| A — Chuyên nghiệp, có bản sắc **(đề xuất)** | Nền sáng, chữ tối, một màu nhấn xanh ngọc; poster tạo cảm xúc ở khu khách hàng; bảng và form rõ ràng ở khu vận hành | Muốn phục vụ nhiều loại sự kiện và dùng lâu dài |
| B — Năng động, thiên về giải trí | Typography lớn, hình sự kiện nổi bật, hero tối và điểm nhấn mạnh; khu vận hành vẫn sáng, tiết chế | Định hướng chính là âm nhạc, lễ hội |
| C — Tối giản, thiên về công việc | Xanh lam/slate, ít trang trí, ưu tiên nội dung và thao tác | Muốn MVP dễ phát triển, phù hợp hội nghị/hội thảo |

Nên chọn A làm bản đầu tiên. Một hệ component chung cho cả ba nhóm người dùng; không biến Organizer/Admin thành hai sản phẩm có phong cách rời rạc. Màu xanh ở trang scaffold hiện tại chưa phải nhận diện thương hiệu được duyệt.

## 2. Dùng công cụ nào?

| Phương án | Cách dùng cho dự án này | Lưu ý bàn giao |
| --- | --- | --- |
| Chuyên gia thiết kế trực tiếp trong Figma Design **(đề xuất)** | Nhận brief, làm luồng và wireframe, thống nhất hướng A rồi dựng component và màn hình | Yêu cầu source editable, Auto Layout, variants và prototype; dùng [Dev Mode](https://www.figma.com/dev-mode/) để hỗ trợ bàn giao cho lập trình viên |
| Figma AI hỗ trợ bản nháp | Dùng prompt theo từng nhóm màn hình rồi để chuyên gia chỉnh cấu trúc và tương tác | [Figma AI](https://www.figma.com/ai/) hỗ trợ thiết kế; không coi kết quả tự sinh là đã đáp ứng nghiệp vụ hoặc accessibility |
| Google Stitch để thử concept | So sánh nhanh bố cục/phong cách từ mô tả trước khi đầu tư hoàn thiện | [Stitch](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/) hỗ trợ tạo UI từ đầu vào mô tả; cần thống nhất cách dựng lại/chuyển sang source Figma, không mặc định có xuất Figma editable đầy đủ |
| Penpot nếu không bắt buộc Figma | Thiết kế cộng tác bằng nền tảng mã nguồn mở, bàn giao trên chính Penpot | Có [prototype](https://penpot.app/design/ux-design) và [inspect cho developer](https://help.penpot.dev/user-guide/dev-tools/); chốt định dạng bàn giao từ đầu |

Đề xuất quy trình: **brief này → chuyên gia làm wireframe trong Figma → duyệt luồng trọng tâm → UI chi tiết → prototype → bàn giao**. Công cụ AI chỉ là lựa chọn hỗ trợ. Không cần mua công cụ vẽ sơ đồ ghế để thiết kế sản phẩm: editor ghế là một màn hình riêng mà ứng dụng sẽ xây dựng.

## 3. Prompt tổng — sao chép gửi chuyên gia

**Cập nhật theo yêu cầu chủ dự án:** sản phẩm phục vụ nhiều loại sự kiện. Thanh điều hướng phải có đủ tám mục trong phần 7. Vé bán lại và Blog là hai khu chức năng riêng, không phải loại sự kiện. Vé bán lại cần luồng theo nhiều nguyên nhân của Organizer; ma trận điều kiện từng nguyên nhân còn cần chốt, không giới hạn vào tăng sức chứa.

```text
Bạn là Senior Product Designer thiết kế nền tảng Event Ticketing cho thị trường
Việt Nam. Hãy tạo bản thiết kế UI/UX trên Figma với layer, text, component có thể
chỉnh sửa, Auto Layout, variants và prototype. Không chỉ trả ảnh hoặc landing page.
Đọc đặc tả được gửi kèm; đánh dấu câu hỏi còn mở, không tự thêm quy tắc kinh doanh.

CATALOG VÀ ĐIỀU HƯỚNG BẮT BUỘC
Đây là nền tảng đa loại sự kiện, không phải website chuyên concert.
Thanh điều hướng theo thứ tự: Nhạc sống | Thể thao | Sân khấu & Nghệ thuật |
Hội thảo & Workshop | Tham quan & Trải nghiệm | Khác | Vé bán lại | Blog.
Sáu mục đầu là danh mục sự kiện; hai mục cuối dẫn tới khu chức năng riêng.
Header có thương hiệu riêng, tìm kiếm, Tạo sự kiện, Vé của tôi và đăng nhập/tài khoản.
Ảnh Ticketbox được gửi là tham khảo tổ chức điều hướng, không phải logo/brand để sao chép.
Trang chủ phải có nội dung đại diện đủ sáu danh mục, không toàn poster ca nhạc.
Mỗi danh mục có trang danh sách, lọc, kết quả rỗng và trạng thái đang chọn.
Blog có danh sách và chi tiết bài viết; không tự thêm bình luận hoặc quyền CMS Admin.
Vé bán lại có thể phát sinh từ nhiều nguyên nhân của Organizer; tăng sức chứa chỉ là ví dụ.
Ví dụ 200 → 300 chỉ mở thêm tối đa 100; không có người bán cá nhân hoặc chuyển nhượng QR.
Danh mục không quyết định kiểu tồn kho: không ép mọi sự kiện vào sơ đồ sân khấu.
Không gian là khối do Organizer thiết kế, sức chứa do Organizer đề xuất/Admin duyệt.
Có template chọn khu/loại vé/số lượng cho khối không đánh số; yêu cầu đã chốt,
nhưng BE/SQL hiện tại cần mở rộng để hỗ trợ. Ghế đánh số chỉ dùng khi bố trí có ghế.

MỤC TIÊU
Khách tìm sự kiện, chọn suất và ghế, mua vé, nhận vé và check-in thuận tiện.
Tổ chức tự quản lý sự kiện, vé và sơ đồ ghế. Admin duyệt tổ chức/hồ sơ sự kiện,
soạn phiếu lý do và xử lý report. Thiết kế phải làm rõ trạng thái và hành động
tiếp theo, kể cả khi hết hạn, thất bại hoặc đang chờ xử lý.

HƯỚNG HÌNH ẢNH
Đề xuất hướng A: hiện đại, sáng, dễ đọc; nền trung tính sáng, chữ đậm màu,
một màu nhấn xanh ngọc. Poster là điểm nổi bật của trang khám phá sự kiện.
Khu vận hành dùng bảng, form và thông tin trạng thái rõ ràng, không lạm dụng card.
Ưu tiên font hỗ trợ tiếng Việt tốt, ví dụ Be Vietnam Pro hoặc Inter.
Dùng một hệ token/component cho Customer, Organizer và Admin.
Đề xuất kích thước tham chiếu desktop 1440, tablet 768, mobile 390 và kiểm tra
không tràn ngang ở 320px. Đây là mục tiêu thiết kế, chưa là brand được phê duyệt.

VAI TRÒ VÀ XÁC THỰC
- Guest xem sự kiện nhưng phải đăng nhập trước khi giữ ghế/mua vé.
- Customer dùng Google hoặc OTP điện thoại; không mật khẩu, không guest checkout.
- Organizer là tổ chức. Người đại diện xác minh email công ty qua Google Workspace
  hoặc email OTP và chờ Admin duyệt. Không tự chọn role Organizer để có quyền ngay.
- Workspace tổ chức chỉ mở khi tổ chức đã được duyệt và membership còn hiệu lực;
  tài khoản Gmail/điện thoại cá nhân không tự đủ quyền quản lý tổ chức.
- Hiển thị tổ chức đang thao tác. Không đăng ký Admin công khai hay tài khoản dùng chung.
- Hỗ trợ đa thiết bị, không tự đặt giới hạn số thiết bị.

ĐẶT VÉ
- Một đơn cho một suất; tối đa 6 ghế. Hold 5 phút, checkout/reload/đổi thiết bị
  không đặt lại đồng hồ. Một người có tối đa một phân bổ còn hiệu lực trên mỗi suất,
  gồm cả đơn đang chờ thanh toán. Khôi phục đúng tiến trình có sẵn khi quay lại.
- Khai tên người tham dự cho từng vé, không mặc định mọi vé mang tên người mua.
- Mã loại vé như VIP khác mã vé riêng do hệ thống cấp cho từng vé đã phát hành.
- QR và mã vé biểu diễn cùng credential riêng; không nhúng tên hay thông tin riêng tư.
- Thanh toán MVP là mô phỏng, phải gắn nhãn. Không dựng form thu thẻ ngân hàng thật.
- Tiền đến muộn hoặc chưa rõ kết quả: hiển thị đang xác minh/đối soát; không tự báo
  thành công, không tạo đơn mới hoặc lấy lại ghế đã hết quyền giữ.
- Không thêm coupon, phí dịch vụ, loyalty hoặc vé miễn phí. Mục Vé bán lại đã được
  yêu cầu, có luồng lý do và xét duyệt phù hợp; không tự suy ra marketplace chuyển nhượng.
- Hoàn tiền toàn phần theo chính sách, Organizer xử lý thông thường; deadline chưa chốt.
  Không tự hứa “hoàn trước 24 giờ”, không tự đưa ghế hoàn lại lên bán.

CHECK-IN VÀ VÀO CỬA LÀ HAI BƯỚC
- Online check-in mở 24 giờ trước giờ bắt đầu suất và đóng khi suất bắt đầu.
  Người mua đã đăng nhập chọn vé thuộc đơn của mình, xác nhận tên và mã vé hệ thống.
- Có thể check-in tại quầy bằng tên và mã vé; không bắt khách đăng nhập tại quầy.
  Đã check-in online thì quầy hiển thị kết quả có sẵn, không tạo lượt mới.
- Check-in chỉ là xác nhận trước; vé vẫn hợp lệ, chưa bị sử dụng vào cửa.
- Quét QR/mã tại cửa là thao tác riêng, cần đã check-in và vé hợp lệ trong giờ cho phép;
  thành công mới đánh dấu đã vào cửa. Quét trùng trên hai thiết bị chỉ một lượt thành công.
- Phân biệt “Chưa check-in”, “Đã check-in”, “Đã vào cửa”, “Đã hoàn tiền/hủy”.
- Mã số thẻ ở yêu cầu chính là mã vé hệ thống, không phải số thẻ ngân hàng/CCCD.
- Giờ quầy và giờ vào cửa theo cấu hình suất; không tự đặt mốc. Không hứa quét offline.

TỔ CHỨC VÀ SƠ ĐỒ GHẾ
- Tổ chức tạo sự kiện, suất, loại vé/giá và layout; gửi Admin duyệt để được đăng.
- Venue là danh mục tìm/chọn theo tên/thành phố, có địa chỉ, timezone, sức chứa và
  biên không gian. Tổ chức không sửa giới hạn venue chung.
- Thiết kế editor kéo thả 2D: thanh công cụ/layers bên trái, canvas giữa,
  inspector bên phải. Canvas có biên cố định, sân khấu, lối đi, khu/hàng/ghế.
- Có tạo hàng/lưới ghế, đánh số, chỉnh bằng form, chọn nhiều, undo/redo, grid/snap,
  zoom/pan, đếm sức chứa, cảnh báo vượt biên/chồng ghế/vùng cấm/trùng mã/vượt sức chứa.
- Có lưu nháp, preview khách, xác nhận đóng băng và trạng thái chỉ đọc.
  Khi xung đột phiên bản, cho xem thông báo và tải bản mới, không ghi đè âm thầm.
- Seat picker của khách dùng cùng sơ đồ, chỉ chọn ghế. Hiển thị trạng thái bằng cả
  màu và ký hiệu/chú giải; không tiết lộ người đang giữ ghế khác.
- Mobile có pan/zoom, bộ lọc/danh sách ghế thay thế và bottom sheet ghế đã chọn.
  Đề xuất editor ưu tiên desktop/tablet; ghi rõ phương án mobile để chủ dự án duyệt.

DUYỆT VÀ QUYỀN ADMIN
- Admin duyệt tổ chức/role, duyệt hồ sơ sự kiện; quản lý thường ngày thuộc tổ chức.
  Can thiệp nghiệp vụ khác chỉ theo report đang mở/đang xử lý, có lý do và lịch sử.
  Không thiết kế nút Admin sửa mọi giá/ghế/sự kiện ngoài luồng report.
- Hồ sơ phải gửi trước suất sớm nhất ít nhất một tháng LỊCH, không đổi thành 30 ngày.
  Mỗi hồ sơ có hạn 15 x 24 giờ từ khi gửi; hiển thị ngày gửi/hạn và timezone.
- Chỉ duyệt bản đã gửi; đang chờ duyệt thì chỉ đọc, muốn sửa phải rút và gửi lại.
  Đã đăng không được sửa trực tiếp để vượt quy trình duyệt.
- Hết hạn: hồ sơ hết hạn, sự kiện không được đăng và ở trạng thái bị từ chối;
  thông báo hồ sơ đã bị hủy do hết hạn, chờ Admin gửi giải thích.
  Không gọi đây là hủy một sự kiện đã bán vé, không tự duyệt hay duyệt muộn.
- Có hàng đợi phiếu giải thích chưa gửi. Form gồm metadata chỉ đọc, nhóm lý do,
  nội dung lý do bắt buộc, hướng dẫn bổ sung tùy chọn, lưu nháp, xem trước,
  xác nhận gửi. Có mẫu gợi ý nhưng Admin phải soạn/xác nhận; phiếu đã gửi chỉ đọc,
  có người gửi và thời gian. Thông báo hết hạn khác phiếu giải thích.
- Report có mô tả, đối tượng liên quan, người xử lý và trạng thái; không tự thêm chat,
  file đính kèm hoặc cam kết thời gian hỗ trợ.

CHẤT LƯỢNG VÀ PHẠM VI
Dùng nội dung tiếng Việt thực tế, dữ liệu giả. Tiền tệ chưa chốt: nếu minh họa VND,
ghi chú trong trang assumptions rằng đây chỉ là dữ liệu demo. Không bịa sức chứa
của venue thật. Không thêm điều kiện refund, xung đột lịch venue hoặc giờ bán chưa chốt.
Đề xuất mục tiêu WCAG 2.2 AA: contrast, focus/keyboard, nhãn form, lỗi gắn với trường,
không chỉ dùng màu; các thao tác quan trọng trên mobile có vùng chạm đủ lớn.
Không đưa SQL, token, cấu hình máy chủ hoặc thông tin bí mật vào giao diện khách.

CÁCH LÀM VÀ BÀN GIAO
Trước hết trả sitemap, các luồng chính, giả định/câu hỏi và wireframe của 6 màn:
chi tiết sự kiện, chọn ghế mobile, checkout, editor ghế desktop, chi tiết hồ sơ duyệt,
phiếu lý do hết hạn. Sau khi thống nhất mới làm high-fidelity và mở rộng theo inventory.
Mỗi lượt làm một nhóm màn hình, giữ nguyên design system đã thống nhất.
Bàn giao foundation/tokens, components/variants, màn hình responsive, trạng thái lỗi,
prototype có nhánh thất bại và chú thích cho developer. Không xem nút bấm mô phỏng
hoạt động trong prototype là bằng chứng backend đã xử lý đúng nghiệp vụ.
```

## 4. Prompt tiếp nối theo từng đợt

Luôn gửi kèm prompt tổng hoặc giữ nó trong cùng ngữ cảnh. Các prompt dưới đây bổ sung phạm vi, không thay thế ràng buộc nghiệp vụ.

### Đợt A — Nền tảng và khách hàng

```text
Tiếp tục brief Event Ticketing đã thống nhất. Tạo foundations và components dùng chung
trước: typography, semantic colors, spacing, button, field/OTP, alert, dialog, tabs,
table, status badge, event card, ticket card, seat legend và countdown.
Thiết kế luồng khám phá → chi tiết → chọn suất/ghế → đăng nhập nếu cần → giữ ghế
→ tên từng người tham dự → thanh toán mock → đơn/vé → online check-in.
Trang chủ và trang danh mục phải thể hiện đủ sáu loại sự kiện theo catalog đã chốt;
giữ thêm hai mục điều hướng Vé bán lại và Blog. Thiết kế danh sách/chi tiết bài blog.
Không giữ ghế cho guest; sau đăng nhập phải kiểm tra lại availability.
Tách các trạng thái loading, rỗng, lỗi, ghế vừa bị giữ, hết 5 phút, đang đối soát,
thanh toán thành công và thất bại. Đổi thiết bị phải khôi phục thời hạn còn lại.
Thiết kế vé với mã loại vé và mã vé riêng rõ nghĩa; không dùng QR chứa dữ liệu thật.
Online check-in có trạng thái chưa mở, mở, đã xác nhận, đã đóng và vé không hợp lệ.
Bổ sung quản lý phiên thiết bị, chi tiết đơn, yêu cầu hoàn tiền và tạo/xem report.
Prototype cả happy path và nhánh hết hạn giữ ghế; ưu tiên trải nghiệm mobile.
```

### Đợt B — Tổ chức và công cụ vẽ ghế

```text
Tiếp tục cùng design system. Thiết kế đăng ký tổ chức bằng email công ty, xác minh,
chờ duyệt, bị từ chối và workspace được duyệt. MVP có một người đại diện được duyệt;
không tự thêm hệ phân cấp nhân sự hoặc flow mời đội ngũ phức tạp.
Tạo quản lý sự kiện → thông tin → venue → suất/loại vé → layout → kiểm tra → gửi duyệt.
Tập trung editor 2D theo brief: minh họa từ venue trống đến sân khấu, lối đi, 3 khu ghế,
tạo hàng/lưới, sửa nhãn bằng inspector, kiểm tra giới hạn, preview khách và đóng băng.
Dùng venue giả, ghi rõ capacity/bounds demo. Có cảnh báo hình học ở canvas và inspector,
trạng thái save/error/unsaved/version conflict/read-only; có cách nhập thông số bằng bàn phím.
Bổ sung quản lý đơn, hoàn tiền, check-in quầy và quét vào cửa thành hai thao tác riêng.
Prototype quét trùng và vé đã check-in online đến quầy; không dùng cùng nút cho cả hai bước.
Dashboard chỉ tổng hợp dữ liệu hữu ích như số vé bán và hồ sơ cần xử lý, không bịa KPI.
```

### Đợt C — Admin và phiếu lý do

```text
Tiếp tục cùng design system. Thiết kế workspace Admin gồm duyệt tổ chức, hàng đợi
hồ sơ sự kiện, chi tiết bản gửi, phiếu lý do và report. Ưu tiên bảng có filter/status,
thời hạn và hành động rõ ràng; không mở bằng dashboard biểu đồ trang trí.
Ở hồ sơ còn hạn có duyệt/từ chối và xác nhận. Đến hạn thì vô hiệu thao tác duyệt,
hiển thị hồ sơ hết hạn và tác vụ soạn giải thích, kể cả khi admin đang mở trang.
Form phiếu có dữ liệu hồ sơ tự điền chỉ đọc, nhóm lý do, nội dung bắt buộc,
hướng dẫn tùy chọn, mẫu gợi ý, lưu nháp, preview và xác nhận gửi.
Minh họa lỗi thiếu lý do, gửi lỗi có thể thử lại, gửi thành công và phiếu chỉ đọc.
Report phải có trạng thái, booking/event liên quan, lý do can thiệp và lịch sử;
report đóng không cho tiếp tục hành động can thiệp. Không thêm quyền quản lý thường nhật.
Prototype hồ sơ hết hạn → phiếu → gửi → tổ chức đọc thông báo và lời giải thích.
```

## 5. Inventory để nghiệm thu phạm vi

Các nhóm có thể dùng nhiều frame hoặc variants; không nhất thiết một dòng bằng một trang riêng.

| Khu vực | Màn hình/nhóm màn hình cần có |
| --- | --- |
| Public | Trang chủ đa danh mục; sáu trang danh mục/tìm kiếm/lọc; kết quả rỗng; chi tiết sự kiện, suất, venue; menu mobile đủ tám mục |
| Nội dung và mở rộng | Blog: danh sách/chi tiết; Vé bán lại: hồ sơ nhiều nguyên nhân; khối không đánh số: chọn loại vé/số lượng; feedback/sao và uy tín |
| Xác thực | Google/OTP điện thoại; OTP lỗi/hết hạn; email công ty; chờ duyệt/từ chối; mất quyền truy cập |
| Mua vé | Seat picker desktop/mobile; ghế đã chọn; hold; checkout với tên từng vé; thanh toán mock và phục hồi kết quả |
| Tài khoản | Danh sách/chi tiết đơn, vé và check-in online; thiết bị đăng nhập; yêu cầu hoàn tiền; report và thông báo |
| Tổ chức | Đăng ký/xác minh; tổng quan; danh sách/tạo sự kiện; suất/loại vé; venue picker; editor/preview; tiến trình duyệt và phiếu nhận được |
| Vận hành | Đơn/vé; xử lý hoàn tiền; check-in quầy; admission và kết quả quét lỗi/trùng |
| Admin | Duyệt tổ chức; hàng đợi/chi tiết hồ sơ; phiếu nháp/preview/đã gửi; report/chi tiết can thiệp/lịch sử |
| Dùng chung | Loading, empty, error/retry, 403/404, hết phiên, xác nhận thao tác, thông báo thành công/thất bại |

## 6. Tiêu chí nhận file từ chuyên gia

- File có các page: `00 Brief & Flows`, `01 Foundations`, `02 Components`, `03 Customer`, `04 Organizer`, `05 Admin`, `06 Prototype & Handoff`.
- Text/layer sửa được; component có variants và tên nhất quán. Auto Layout/constraints thể hiện cách co giãn, không chỉ nhiều ảnh ở các kích thước khác nhau.
- Có token màu ngữ nghĩa, typography, spacing, radius; icon nhất quán, nguồn/quyền dùng asset ghi rõ. Logo và poster chưa có thì dùng placeholder có chú thích.
- Có luồng desktop/mobile trọng tâm, focus, lỗi form, điều hướng bàn phím, cách chọn ghế thay thế canvas. Mục tiêu accessibility là đề xuất cần kiểm tra khi triển khai, không tự gắn nhãn đã đạt chuẩn.
- Prototype chứng minh được: hết hold; khôi phục đơn ở thiết bị khác; check-in trước rồi vào cửa; quét trùng; layout vượt giới hạn; hồ sơ hết hạn và phiếu lý do.
- Nút nguy hiểm có xác nhận phù hợp; pending/expired/read-only không chỉ đổi màu mà thay hành động hợp lệ. Không hiện quyền sai cho người dùng khác tổ chức.
- Ghi chú hành vi ở phần handoff, tách khỏi copy hiển thị cho khách. Mỗi màn có trạng thái, hành động, điểm đến và dữ liệu cần hiển thị.
- Có bảng assumptions: currency demo, hạn refund chưa chốt, giờ quầy/cửa theo cấu hình, nguồn venue thật, trùng lịch và thời điểm dừng bán còn mở. Không biến placeholder thành quyết định đã duyệt.
- Nhận đường dẫn source, quyền truy cập/chỉnh sửa đã thống nhất, prototype và tài nguyên export cần thiết. Ảnh PNG/PDF chỉ là bản xem thêm, không thay source editable.

Không gửi `.env`, mật khẩu database, token, thông tin khách thật hoặc QR sử dụng thật cho chuyên gia/công cụ tạo UI. Tài liệu này dùng dữ liệu giả và không yêu cầu thay đổi code, SQL hay môi trường.

## 7. Catalog đa loại sự kiện và tham khảo điều hướng

Yêu cầu bổ sung của chủ dự án ngày 2026-09-13, kèm ảnh header Ticketbox. Dùng ảnh để tham khảo cách nhóm tìm kiếm, hành động tài khoản và điều hướng; xây nhận diện riêng cho dự án. Không cần thêm carousel chỉ vì ảnh có banner.

| Thứ tự | Nhãn điều hướng | Điểm đến và nội dung minh họa |
| --- | --- | --- |
| 1 | Nhạc sống | Danh sách concert, acoustic, biểu diễn trực tiếp |
| 2 | Thể thao | Danh sách trận đấu, giải đấu; chi tiết có thông tin môn/đội khi phù hợp |
| 3 | Sân khấu & Nghệ thuật | Kịch, múa, chương trình nghệ thuật; thông tin tác phẩm/đơn vị biểu diễn |
| 4 | Hội thảo & Workshop | Hội thảo, lớp thực hành; chương trình, diễn giả/hướng dẫn và yêu cầu tham dự |
| 5 | Tham quan & Trải nghiệm | Chuyến tham quan, hoạt động trải nghiệm; thời lượng, điểm hẹn, nội dung bao gồm |
| 6 | Khác | Các sự kiện chưa thuộc năm nhóm trên, không phải nơi chứa Blog/Vé bán lại |
| 7 | Vé bán lại | Khu chức năng riêng cho các trường hợp mở bán lại; điều kiện từng nguyên nhân cần chốt |
| 8 | Blog | Danh sách và chi tiết bài; đọc bài rồi chuyển sang sự kiện liên quan nếu có |

Các trường đặc thù như môn thể thao, đội, diễn giả, thời lượng là đề xuất cách trình bày nội dung; có thể nằm trong mô tả sự kiện ở phiên bản đầu. Không mặc định đã có cột dữ liệu hoặc bộ lọc API riêng cho chúng.

**Desktop:** hàng đầu gồm logo, ô tìm kiếm “Bạn muốn tìm sự kiện gì?”, Tạo sự kiện, Vé của tôi, tài khoản. Hàng thứ hai chứa đủ tám mục, có selected/focus state. Tạo sự kiện dẫn đúng onboarding/workspace theo quyền; Vé của tôi yêu cầu đăng nhập rồi quay lại đúng trang.

**Mobile:** header gọn, tìm kiếm dễ mở; danh mục có thể cuộn ngang kèm nút mở toàn bộ menu. Menu phải truy cập được đủ tám mục, không để Blog/Vé bán lại biến mất ngoài màn hình mà không có chỉ dẫn. Không dùng hover làm cách duy nhất để điều hướng.

**Trang chủ:** hero trung tính về loại hình hoặc bộ nội dung luân phiên cân bằng; lối vào sáu danh mục và danh sách sự kiện đa dạng. Không dùng nhãn “Đêm diễn”/“Nghệ sĩ” cho mọi card: mặc định “Sự kiện”, “Đơn vị tổ chức”, “Thời gian”, “Địa điểm”; chỉ dùng từ chuyên biệt khi phù hợp. Card có tiêu đề, hình, ngày, địa điểm và giá từ dữ liệu, không giả giá/độ khan hiếm.

**Chi tiết sự kiện:** dùng khung chung cho tiêu đề, đơn vị tổ chức, ngày giờ, địa điểm, mô tả, chính sách và CTA; khu nội dung thích ứng với từng loại. Workshop không bắt buộc có sân khấu, trải nghiệm không bắt buộc có hàng ghế. Check-in luôn tính theo suất/khung giờ đã đặt, không gộp một ngày cho mọi suất của sự kiện.

**Mô hình mục tiêu:** không gian là khối do Organizer thiết kế và đề xuất sức chứa, Admin xét duyệt. Khối không đánh số có luồng chọn khu/loại vé/số lượng; ghế chỉ dùng khi bố trí có ghế. Đây là yêu cầu sản phẩm, nhưng BE/SQL hiện dựa trên ghế nên chưa hỗ trợ đầy đủ; không tạo ghế giả để che giới hạn.

**Blog:** thiết kế trang danh sách với card bài viết và chi tiết có tiêu đề, ngày, tác giả/đơn vị biên tập, nội dung, ảnh và sự kiện liên quan nếu có. Không bịa bài thật hoặc biến Blog thành bộ lọc sự kiện. Quyền tác giả/duyệt bài, CMS và xuất bản chưa chốt; không tự giao thêm vận hành nội dung cho Admin.

**Vé bán lại:** thiết kế hồ sơ theo loại yêu cầu, lý do, ảnh hưởng người mua và quyết định phù hợp; không chỉ tăng sức chứa. Ví dụ 200 → 300 là một test case. Không tự phát sinh giao dịch vé cá nhân. Xem [23, phần 9](23-organization-review-seatmap.md).

## 8. Kết quả rà soát tiêu chí thiết kế

Đây là kiểm tra **độ bao phủ của brief**, không phải nghiệm thu một file Figma đã dựng. Chưa có bản thiết kế trực quan hoặc prototype để kiểm tra pixel, usability và accessibility thực tế.

| Tiêu chí | Kết quả rà soát | Điều kiện trước khi nghiệm thu UI |
| --- | --- | --- |
| Sản phẩm đa loại sự kiện | Đã bổ sung sáu danh mục, nội dung mẫu và template thích ứng | Kiểm tra đủ sáu ví dụ, không dùng toàn concert/sơ đồ sân khấu |
| Điều hướng theo yêu cầu | Đã mô tả đủ tám mục và header desktop/mobile | Mọi mục có điểm đến, active state và truy cập bằng bàn phím |
| Vé bán lại | Luồng chung nhiều nguyên nhân, không chỉ tăng sức chứa | Có lý do, tác động người mua và xét duyệt phù hợp |
| Blog | Đã bổ sung UI danh sách/chi tiết | Cần chốt vận hành nội dung khi triển khai, chưa tự thêm CMS |
| Ghế và vé không đánh số | Khối/khu có sức chứa và ghế tùy bố trí đã được yêu cầu | Phân biệt UI mục tiêu với BE/SQL chưa hỗ trợ đầy đủ |
| Organizer là tổ chức, email công ty, Admin duyệt | Đã có trong prompt tổng và đợt B/C | Prototype chờ duyệt, từ chối, mất quyền và workspace đúng tổ chức |
| Đăng nhập trước mua, đa thiết bị, hold | Đã có | Kiểm tra ghế đổi trạng thái và khôi phục countdown, không reset thời hạn |
| Tên/mã vé, check-in và admission | Đã tách rõ | Demo xác nhận trước và quét vào cửa riêng, có nhánh quét trùng |
| Venue có giới hạn, editor kéo thả | Đã có | Prototype vượt biên/capacity, preview, chỉ đọc và xung đột phiên bản |
| Một tháng lịch, hạn 15 ngày, phiếu lý do | Đã có | Demo hồ sơ hết hạn khi đang mở trang và phiếu gửi chỉ đọc |
| Quyền Admin theo review/report | Đã có | Không xuất hiện quyền sửa vận hành ngoài report hợp lệ |
| Responsive, component và accessibility | Đã đặt yêu cầu bàn giao | Chưa thể tuyên bố đạt khi chưa có Figma và triển khai để kiểm tra |

Khi chuyên gia gửi bản đầu, dùng bảng này đánh dấu từng frame/flow tương ứng. Yêu cầu còn mở phải có ghi chú, không dùng hình đẹp để che thiếu nghiệp vụ.

## 9. Prompt bổ sung — tình huống vận hành, feedback và uy tín

Gửi cùng prompt tổng. Nguồn nghiệp vụ là [23, phần 9](23-organization-review-seatmap.md); các trọng số/ngưỡng tính điểm và chính sách hủy chưa chốt, không biến dữ liệu demo thành cam kết.

```text
Mở rộng thiết kế Event Ticketing như nền tảng trung gian đa loại sự kiện.
Vé bán lại không chỉ là tăng sức chứa: dùng form hồ sơ chung với loại yêu cầu,
lý do, thông tin trước/sau, ảnh hưởng người mua và phương án xử lý. Tăng từ 200
lên 300 chỉ là một ví dụ; không đóng cứng UI theo con số hoặc nguyên nhân đó.
Thiết kế canvas khối/khu với sức chứa đề xuất để Admin xét, ghế là tùy bố trí.
Các trường hợp mở bán lại có điều kiện khác nhau; đánh dấu phần chính sách còn mở.

Thêm chức năng Organizer hủy sự kiện: form lý do, phạm vi, đơn/vé bị ảnh hưởng,
phương án xử lý, preview thông báo và xác nhận. Tách trạng thái sự kiện đã hủy
khỏi tình trạng hoàn tiền của từng đơn. Có chờ xử lý, đang hoàn, hoàn thất bại,
đã hoàn; không báo đã hoàn khi chỉ gửi yêu cầu. Không xóa lịch sử sự kiện.
Không tự coi hủy sự kiện đang bán giống hồ sơ đăng sự kiện hết hạn.

Customer có form feedback phân biệt Hệ thống và Sự kiện/nhà tổ chức, lựa chọn
sao 1–5 (thang đề xuất), nội dung và đơn/sự kiện liên quan nếu có. Đánh giá có
giao dịch xác thực có nhãn Đã mua vé, không công khai dữ liệu đơn/mã vé.
Khách của sự kiện bị hủy vẫn có kênh feedback, không bắt buộc check-in.
Có đã gửi, sửa, lỗi, chờ kiểm tra và ẩn có lý do; phân biệt đánh giá với report
yêu cầu hỗ trợ. Phản hồi về lỗi website không trừ điểm nhà tổ chức.

Organizer có trang feedback, phản hồi/báo cáo đánh giá sai và xem lịch sử uy tín;
không có nút tự xóa đánh giá xấu. Dùng dữ liệu mẫu rõ ràng, không tạo review thật giả.

Admin xem hồ sơ bên cạnh panel uy tín tổ chức: điểm nội bộ, sao trung bình,
số mẫu xác thực, trạng thái Chưa đủ dữ liệu, lịch sử tổ chức/hủy, các vấn đề
đã xác minh, việc xử lý người mua và lịch sử tăng/giảm điểm kèm lý do.
Tách sao người dùng khỏi điểm thuật toán, không công khai điểm nội bộ khi chưa chốt.
Có chi tiết nguồn điểm, phiên bản chính sách, thời gian và điều chỉnh/kháng nghị.
Report chưa kết luận không tự là điểm phạt; hủy phải xét nguyên nhân và khắc phục.
Điểm giúp Admin quyết định, không tự duyệt hay khóa tài khoản theo ngưỡng tự bịa.
Các nút kiểm duyệt/điều chỉnh điểm phải nằm trong quyền và có audit/lý do.

Prototype các nhánh: tổ chức mới chưa đủ dữ liệu; sự kiện bị hủy và khách chờ
xử lý tiền; feedback hệ thống không đổi điểm tổ chức; phản ánh được xác minh
dẫn đến điều chỉnh điểm; kháng nghị được chấp nhận và sửa đóng góp điểm;
Admin xem điểm/bằng chứng rồi quyết định hồ sơ với lý do.
```

| Tiêu chí bổ sung | Màn/flow cần bàn giao | Trạng thái hiện tại |
| --- | --- | --- |
| Mở bán lại nhiều nguyên nhân | Form yêu cầu chung, trước/sau, xét duyệt và kết quả | Đã có yêu cầu UI; ma trận chính sách chưa chốt |
| Organizer hủy sự kiện | Xác nhận ảnh hưởng, thông báo khách, tình trạng xử lý từng đơn | Đã có yêu cầu UI; hạn/luồng tiền cần chốt |
| Feedback có sao | Hệ thống và sự kiện tách biệt, xác thực giao dịch, kiểm duyệt/khiếu nại | Đã có yêu cầu; chưa triển khai |
| Uy tín tổ chức | Panel Admin, lịch sử nguồn điểm, tổ chức mới và điều chỉnh | Công thức đề xuất ở 23; hệ số/ngưỡng chưa chốt |
| Quyết định Admin | Hồ sơ + điểm + căn cứ + lý do, snapshot lúc quyết định | Không tự approve hoặc tự khóa bằng điểm |

Các màn này bổ sung inventory phần 5 và bảng nghiệm thu phần 8. Chưa có file Figma/prototype để xác nhận đạt về trực quan hoặc khả dụng.

## 10. Prompt bổ sung — merchandise và nhận diện sự kiện

Nguồn: [23, phần 10](23-organization-review-seatmap.md). Đã chốt thanh toán trên web, giao tới địa chỉ người nhận và điều kiện vé do Organizer cấu hình. Phí/phạm vi vận chuyển, đổi trả và chi tiết xác minh vé chưa chốt.

```text
Bổ sung merchandise trong từng sự kiện cho nền tảng Event Ticketing.
Ví dụ minh họa: Organization là công ty chủ quản dùng email công ty; sự kiện
là Fanmeeting PMC; tag nổi bật trên card/header/gian hàng là PMC. Dùng thương hiệu
minh họa này làm ví dụ, không giới hạn sản phẩm vào ca nhạc hoặc fanmeeting.
Tên công ty vẫn xuất hiện ở thông tin Đơn vị tổ chức và đơn hàng, không làm mất
ownership/uy tín khi đổi tag. Tag nghệ sĩ khác danh mục sự kiện; không tự thêm
badge nghệ sĩ đã xác minh hoặc đổi hệ catalog tám mục đã thống nhất.

Customer: thiết kế khu Merchandise trong trang sự kiện, danh sách sản phẩm,
chi tiết, chọn biến thể khi có, số lượng, giá/tồn kho và tóm tắt hàng đã chọn.
Hình/giá dùng dữ liệu giả rõ ràng; không tự thêm phí, preorder hoặc khuyến mãi.
Có sản phẩm không có biến thể, biến thể hết hàng, lỗi tải, tồn kho vừa thay đổi.
Thông tin đơn tách dòng vé và hàng; đã trả tiền khác đã nhận hàng, mua hàng
không mặc định có vé vào cửa. Không dùng QR vé làm mã nhận merchandise.
Thanh toán trên web và giao đến địa chỉ người nhận. Organizer chọn mua tự do hoặc yêu cầu vé;
thiết kế rõ hai điều kiện mua. Phí/phạm vi giao và checkout chung/tách còn cần chốt.

Organizer: tab Merchandise trong sự kiện, danh sách/tạo/sửa sản phẩm, biến thể,
giá, kho, trạng thái bán và danh sách/chi tiết đơn. Hiển thị rõ đang quản lý hàng
của sự kiện nào và tổ chức nào. Ngừng bán không xóa lịch sử; chỉnh sản phẩm
không thay giá/biến thể của đơn cũ. Không cho hàng hóa làm đổi sức chứa.

Admin: giữ quyền theo hồ sơ/report, không tự bổ sung công việc sửa kho/giao hàng.
Phạm vi duyệt merchandise riêng hay cùng sự kiện chưa chốt, ghi chú trong handoff.
Hủy sự kiện cần cho khách xem trạng thái giải quyết vé và hàng riêng, không tự
báo hoàn tiền toàn bộ. Feedback merchandise là phân loại đề xuất, không tự cộng
hoặc trừ thêm điểm uy tín khi chưa có trọng số được duyệt.

Bàn giao component ProductCard, VariantSelector, QuantityInput, StockStatus,
MerchandiseOrderItem (tên gợi ý), responsive và các trạng thái lỗi/rỗng/hết hàng.
Prototype: sự kiện → sản phẩm → kiểm tra điều kiện vé → biến thể/số lượng → địa chỉ → thanh toán → theo dõi giao;
đánh dấu các chính sách phí/đổi trả còn mở. Không coi prototype là hệ thống bán
merchandise đã được triển khai.
```

| Tiêu chí bổ sung | Kiểm tra trong bản thiết kế |
| --- | --- |
| Nhận diện công khai | Tag PMC, tên Fanmeeting PMC và tên công ty đúng vị trí, không nhầm với danh mục |
| Hàng hóa theo sự kiện | Trang sản phẩm và quản lý luôn giữ ngữ cảnh sự kiện/Organization |
| Biến thể và tồn kho | Chọn đúng biến thể, có hết hàng/thay đổi tồn kho; không trừ sức chứa vé |
| Đơn và nhận hàng | Tách trạng thái tiền/hàng/vé; không gán quyền vào cửa cho hàng hóa |
| Chính sách còn mở | Phí/phạm vi giao, xác minh vé, giữ kho, đổi trả và phạm vi duyệt được đánh dấu; không hỏi lại hình thức giao hoặc quyền Organizer chọn điều kiện vé |

Các màn trên bổ sung inventory hiện có; không tạo tài liệu riêng cho ví dụ Fanmeeting PMC.

### Luồng giao hàng và điều kiện mua đã chốt

Organizer chọn **Mua không cần vé** hoặc **Yêu cầu có vé**. Hiển thị nhãn này trên trang sản phẩm; flow thiếu vé có giải thích và liên kết xem vé sự kiện, không âm thầm thêm vé vào giỏ. Kiểm tra server là nguồn xác nhận điều kiện mua; chi tiết trạng thái/quota vé còn cần chốt.

Customer thanh toán trên web, nhận hàng tại địa chỉ đã nhập. Bổ sung form tên người nhận, thông tin liên hệ, địa chỉ, tóm tắt giao hàng và chi tiết đơn. Người nhận hàng có thể khác tên người tham dự trên vé; không dùng chung trường một cách ngầm định. Phí giao, vùng giao và lịch giao chưa chốt nên dùng annotation, không quảng cáo miễn phí/giao toàn quốc hoặc ngày giao chắc chắn.

Prototype đủ hai điều kiện mua, thiếu vé, đủ điều kiện, địa chỉ thiếu/không hợp lệ, hết biến thể khi thanh toán, kết quả thanh toán chưa rõ và trạng thái đang giao/đã giao/giao thất bại. Giữ giao hàng và thanh toán thành hai nhóm trạng thái. Trang Organizer theo dõi đơn và xử lý giao hàng theo quyền, không mặc định đã tích hợp hãng vận chuyển.
