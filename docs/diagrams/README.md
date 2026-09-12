# Bộ sơ đồ hệ thống

**Phiên bản baseline:** Mermaid/SVG/gallery xuất sẵn chưa bao phủ quyết định mới về Organization, review, layout, Google/OTP và CheckIn riêng. Xem [model hiện hành](../23-organization-review-seatmap.md); cần đồng bộ DDL/ERD và xuất lại trước dùng các ảnh này làm thiết kế triển khai. Các chỉ dẫn dưới đây mô tả bộ baseline.

Mở [trang xem sơ đồ offline](index.html), hoặc xem các ảnh SVG dưới đây. Nguồn Mermaid là file cùng tên đuôi .mmd; ERD được sinh từ [schema SQL](../../database/schema.sql).

Hướng dẫn, phạm vi và các quyết định còn mở: [19 — Sơ đồ hệ thống](../19-system-diagrams.md).

## 01 · Bối cảnh hệ thống

[Nguồn Mermaid](01-system-context.mmd) · [SVG](svg/01-system-context.svg)

![01 · Bối cảnh hệ thống](svg/01-system-context.svg)

## 02 · Thành phần backend

[Nguồn Mermaid](02-backend-components.mmd) · [SVG](svg/02-backend-components.svg)

![02 · Thành phần backend](svg/02-backend-components.svg)

## 03 · Mô hình triển khai

[Nguồn Mermaid](03-deployment.mmd) · [SVG](svg/03-deployment.svg)

![03 · Mô hình triển khai](svg/03-deployment.svg)

## 04 · Use case theo vai trò

[Nguồn Mermaid](04-use-cases.mmd) · [SVG](svg/04-use-cases.svg)

![04 · Use case theo vai trò](svg/04-use-cases.svg)

## 05 · ERD tài khoản và phân quyền

[Nguồn Mermaid](05-erd-identity.mmd) · [SVG](svg/05-erd-identity.svg)

![05 · ERD tài khoản và phân quyền](svg/05-erd-identity.svg)

## 06 · ERD sự kiện và địa điểm

[Nguồn Mermaid](06-erd-events.mmd) · [SVG](svg/06-erd-events.svg)

![06 · ERD sự kiện và địa điểm](svg/06-erd-events.svg)

## 07 · ERD đặt vé và thanh toán

[Nguồn Mermaid](07-erd-booking.mmd) · [SVG](svg/07-erd-booking.svg)

![07 · ERD đặt vé và thanh toán](svg/07-erd-booking.svg)

## 08 · ERD vận hành và đối soát

[Nguồn Mermaid](08-erd-operations.mmd) · [SVG](svg/08-erd-operations.svg)

![08 · ERD vận hành và đối soát](svg/08-erd-operations.svg)

## 09 · Luồng đặt vé hoàn chỉnh

[Nguồn Mermaid](09-booking-sequence.mmd) · [SVG](svg/09-booking-sequence.svg)

![09 · Luồng đặt vé hoàn chỉnh](svg/09-booking-sequence.svg)

## 10 · Hai khách tranh cùng ghế

[Nguồn Mermaid](10-seat-race.mmd) · [SVG](svg/10-seat-race.svg)

![10 · Hai khách tranh cùng ghế](svg/10-seat-race.svg)

## 11 · Thanh toán thành công đến muộn

[Nguồn Mermaid](11-late-payment.mmd) · [SVG](svg/11-late-payment.svg)

![11 · Thanh toán thành công đến muộn](svg/11-late-payment.svg)

## 12 · Đăng nhập và luân chuyển token

[Nguồn Mermaid](12-auth-refresh.mmd) · [SVG](svg/12-auth-refresh.svg)

![12 · Đăng nhập và luân chuyển token](svg/12-auth-refresh.svg)

## 13 · Hoàn tiền và check-in đồng thời

[Nguồn Mermaid](13-refund-checkin.mmd) · [SVG](svg/13-refund-checkin.svg)

![13 · Hoàn tiền và check-in đồng thời](svg/13-refund-checkin.svg)

## 14 · Vòng đời booking

[Nguồn Mermaid](14-booking-states.mmd) · [SVG](svg/14-booking-states.svg)

![14 · Vòng đời booking](svg/14-booking-states.svg)

## 15 · Vòng đời payment và refund

[Nguồn Mermaid](15-payment-refund-states.mmd) · [SVG](svg/15-payment-refund-states.svg)

![15 · Vòng đời payment và refund](svg/15-payment-refund-states.svg)

## 16 · Vòng đời vé, ghế và hold

[Nguồn Mermaid](16-ticket-seat-states.mmd) · [SVG](svg/16-ticket-seat-states.svg)

![16 · Vòng đời vé, ghế và hold](svg/16-ticket-seat-states.svg)

## 17 · Outbox, lease và phục hồi worker

[Nguồn Mermaid](17-outbox-worker.mmd) · [SVG](svg/17-outbox-worker.svg)

![17 · Outbox, lease và phục hồi worker](svg/17-outbox-worker.svg)

## 18 · Kiểm tra quyền và ownership

[Nguồn Mermaid](18-authorization.mmd) · [SVG](svg/18-authorization.svg)

![18 · Kiểm tra quyền và ownership](svg/18-authorization.svg)
