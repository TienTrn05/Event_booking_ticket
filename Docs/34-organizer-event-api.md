# 34. Organizer tạo nháp → Admin duyệt → mua vé

BE ưu tiên theo yêu cầu chủ dự án; Google/email cá nhân, onboarding ORGANIZER riêng CUSTOMER theo [33](33-registration-onboarding.md). Tổ chức và sự kiện đều cần Admin duyệt trước mở bán.

## Quyền và dữ liệu

Organizer tạo Organization application/membership PENDING rồi tạo nháp ngay. Admin organizer.approve kích hoạt membership ACTIVE khi duyệt tổ chức. Domain chỉ metadata liên hệ, không là bằng chứng quyền. Mọi API kiểm tra User/phiên/identity/authVersion, permission và ownership trong DB. Admin không được tự đăng ký; chưa cấp Admin thật.

Event DRAFT được chỉnh thông tin, upload R2, tạo layout/session/type/giá. Mọi cấu hình tăng event.version. Gửi duyệt đóng băng layout/snapshot và chuyển PENDING_REVIEW; không sửa bản đó. Rút review còn hạn để sửa lại hoặc mở lại event REJECTED. Published inventory/cấu hình giữ nguyên qua các API này; không xóa lịch sử.

Layout hiện hỗ trợ venue khung chữ nhật gốc (0,0), các ghế chữ nhật, sân khấu/vùng cấm, tên section/row/seat duy nhất. Kiểm tra bounds, overlap và venue capacity, tối đa 5.000 ghế/request. Snapshot venue/version/capacity được lưu; geometry khác trả UNSUPPORTED_VENUE_BOUNDS. Đây là nhánh indoor vé đánh số. Nhánh BE outdoor theo khu/quantity đã bổ sung theo ADR-037; xem [Docs42](42-outdoor-zone-ticketing.md).

Giá nháp trong event_sessions.pricing_config, một entry cho mỗi ghế đang active, ticketType thuộc đúng suất, VND nguyên dương trong giới hạn an toàn payOS. Chưa tạo session_seats trước duyệt; Admin approve materialize inventory trong cùng transaction với publication/trạng thái. Không thêm bảng pricing 1:1.

## Thứ tự qua Swagger

Các mutation cần Bearer, Origin đúng PUBLIC_APP_URL, Idempotency-Key mới cho hành động mới; retry dùng cùng key/body. ID DB/giá là chuỗi, thời điểm có timezone offset và lưu UTC; version lấy từ response mới nhất. Schema đầy đủ trong Swagger.

1. Hoàn tất onboarding ORGANIZER.
2. POST `/organizations/applications` body `{ "name": "Đơn vị thử nghiệm" }`; giữ ID/version.
3. POST `/organizer/events` với organizationId/title/categoryId/description/minimumAge. Category ID số từ catalog DB; onboarding options dùng category slug nên không dùng slug làm categoryId.
4. Upload ảnh qua `/media/uploads` → PUT trực tiếp R2 → `/media/uploads/complete`. purpose event, targetId/event.version; complete tăng version. Không đưa cover URL tùy ý vào event PATCH.
5. POST `/organizer/events/{id}/layouts` với venueId, version, stage/blocked và seats. GET event trả ID layout/ghế. Venue catalog dùng chung, không tự tạo venue riêng.
6. POST `/organizer/events/{id}/sessions`: layoutId/version và startsAt/endsAt/saleOpensAt/saleClosesAt/counterOpensAt/counterClosesAt/admissionOpensAt/admissionClosesAt. Timezone lấy venue, không tin client.
7. POST `/organizer/events/{id}/sessions/{sessionId}/ticket-types`, code/name/version; rồi PUT cùng prefix `/prices` với version và prices[] `{seatId,ticketTypeId,priceMinor,currency:"VND"}` cho mọi ghế.
8. POST `/organizer/events/{id}/submit` với version. Cần đủ ảnh/ghế/loại vé/giá và suất sớm nhất cách thời điểm gửi ít nhất một tháng lịch theo timezone venue. Review có TTL15 ngày.
9. Admin duyệt tổ chức bằng `/admin/organization-applications/{id}/approve` (phiên xác thực trong 5 phút, version/reason). Admin xem `/admin/event-reviews` và `/{reviewId}` snapshot; POST `/{reviewId}/approve` với event.version/reason. Tổ chức chưa được duyệt thì event approval 422.
10. Catalog trả public event ID. Customer đã onboarding → phòng chờ → hold → booking → attendee riêng từng item → payment → vé. Counter/check CCCD/admission theo [32](32-payos-booking-ticket-flow.md).

Không cần FE catalog để kiểm thử BE. Bộ test tích hợp đã tạo chuỗi dữ liệu trên PostgreSQL tạm bằng Admin fixture/payment giả. Không thử chuyển tiền thật và không tự cấp quyền Admin local.

## Review và thông báo

Approve lặp cùng key không phát thêm inventory/notification. Reject cần reason/guidance, lưu reason_notice SENT và REVIEW_REJECTED trong inbox. Worker `worker:bookings` xử lý expiry review cùng codebase: EXPIRED, event REJECTED, notification và notice DRAFT. Admin hoàn thiện `/admin/event-reviews/{id}/reason`, version là notice.version, gửi một lần rồi bất biến. Withdraw còn hạn tại `/organizer/event-reviews/{reviewId}/withdraw`; reopen event bị từ chối tại `/organizer/events/{id}/reopen`.

Follow notification khi event công khai đi qua deferred hook/outbox đã có, worker notifications fan-out. Không gọi SMTP/payOS/R2 trong transaction duyệt.

Các dashboard, sửa sự kiện sau publication, duyệt lại thay đổi inventory hoặc phát hành quantity là công việc tiếp theo theo đặc tả/quyết định riêng; API hiện không mở PATCH status/price đã xuất bản tự do.

Suất nháp có thể sửa bằng PATCH `/organizer/events/{id}/sessions/{sessionId}` với body cấu hình đầy đủ và event.version. Muốn thay sơ đồ, tạo layout mới rồi gán vào suất; giá được xóa khi layout đổi và cần cấu hình lại. Không chỉnh layout đã frozen/public hoặc xóa ghế có giao dịch.

GET `/organizer/event-options` trả category ID số, venue ID/version/timezone/bounds/kích thước/capacity; không cần đọc DB để lấy dữ liệu cấu hình. GET `/organizations/applications` trả các tổ chức do chính người dùng đăng ký, gồm ID/version/trạng thái.

## Sự kiện đã công bố — triển khai ADR-034

Các API bán vé/doanh thu và CONTENT review/cancel/operations mới ở [38](38-organizer-sales-operations.md). Sửa/hủy không đi qua draft PATCH; chỉ title/description và hủy mọi suất chưa bắt đầu/chưa USED theo phạm vi chủ dự án chốt. Không thay lịch/giá hoặc rebuild session_seats. Migration013/seed demo đã áp dụng local, Admin vẫn fixture và không giao dịch thật trong lượt này.

API đọc lịch sử duyệt/snapshot Organizer và Admin, chi tiết CONTENT đối chiếu bản hiện tại đã bổ sung; xem mục API đọc hồ sơ vận hành ở [38](38-organizer-sales-operations.md). Các list pending cũ giữ hợp đồng, không thay auth hoặc thêm migration.
