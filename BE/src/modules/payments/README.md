# payments

Một kênh payOS, VND; PaymentService orchestration qua PaymentGateway, BookingPaymentPort và TicketIssuer. Booking giữ allocation; payment không trực tiếp ghi ghế/đơn. SDK/network ngoài transaction; outbox/inbox sẵn có phục hồi timeout và callback trùng. Ticket issuance và booking confirmation cùng transaction; tiền muộn/dư/thiếu cần đối soát, không tự refund/payout.

HTTP, SQL và provider adapter tách riêng; wiring ở startup/payment.dependencies.ts. API dùng Idempotency-Key, buyer ownership và webhook signature; client redirect không xác nhận tiền. Hợp đồng/checks/config ở [Docs/32](../../../../Docs/32-payos-booking-ticket-flow.md).

Kết quả mua vé: outcome SUCCESS/FAILED hoặc null khi chưa xác nhận; canRetry và expiresAt do BE tính. Lần thất bại chưa nhận tiền được retry trong hạn gốc, không gia hạn hold. Không triển khai workflow Organizer xử lý thiếu/dư; giữ receipt/reconciliation nội bộ và chặn attempt mới khi đã nhận tiền chưa xác nhận. Xem ADR-033/Docs32.

ADR-038: PurchasePaymentPort hỗ trợ merchandise qua cùng provider key/reference/inbox/outbox. XOR target booking/order; callback recheck đúng điều kiện, chỉ booking phát vé. Return/cancel URL merchandiseOrderId, GET payments theo outcome của order. [Docs44](../../../../Docs/44-backend-v1-extensions.md).
