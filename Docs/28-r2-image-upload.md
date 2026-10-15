# 28. Upload ảnh trực tiếp lên Cloudflare R2

Quyết định chủ dự án 2026-10-10, ADR-022: ảnh cá nhân và ảnh sự kiện/sản phẩm nằm trên R2. PostgreSQL chỉ lưu URL ảnh; dữ liệu catalog trước đây cũng chỉ lưu URL, không lưu binary/base64.

## Luồng đã triển khai

1. FE gửi `POST /api/v1/media/uploads` với Bearer JWT, Origin của Public Web, `purpose`, `contentType`, `size`; event/merchandise thêm `targetId` (ID DB dạng chuỗi) và `version` của event.
2. BE kiểm tra phiên và quyền DB. Avatar cần `profile.update_self`. Event/merchandise cần `event.update_own`, membership ACTIVE, Organization APPROVED và đúng company identity của phiên; email/domain không tự cấp quyền. Event chỉ DRAFT, đúng version; merchandise cũng phải DRAFT.
3. BE sinh object key ngẫu nhiên và presigned PUT URL có hạn **5 phút**. Client gửi trực tiếp File đến endpoint S3 của R2, với `Content-Type` và `If-None-Match: *` từ response. Browser tự đặt Content-Length đúng File; signature ràng buộc cả ba header. Không dùng FormData, không đưa JWT/cookie ứng dụng vào request R2.
4. FE gửi `POST /media/uploads/complete` với receipt `uploadToken` có hạn **5 phút**, ràng buộc User/session/target/purpose/type/size. Client không tự chọn object key hoặc URL ảnh.
5. BE đọc HEAD và 12 byte signature ảnh từ R2, đối chiếu type/size; kiểm tra lại quyền/ownership/version trong transaction trước khi lưu URL và audit. Upload ảnh không đi qua BE; chỉ phần header xác minh được đọc về BE. PUT có điều kiện ngăn URL cũ ghi đè object đã upload.

Cho phép JPEG/PNG/WebP, tối đa **5 × 1024 × 1024 byte**; từ chối SVG, HTML và input ngoài schema. Giới hạn 20 request/IP/phút và 10 request/User/phút trên hai route upload (cấp URL và hoàn tất đều tính request); store memory phù hợp local/single-instance, không phải quota phân tán. Receipt/URL ký không lưu ở database, localStorage hoặc log.

Popup Tài khoản đã có upload avatar và tải lại URL đã lưu. `Fe/src/features/media/components/ImageUpload.tsx` và `uploadImage()` dùng chung cho cả ba purpose; caller của event/product cập nhật event version từ response. Editor Organizer và company-email login vẫn chưa có UI/luồng live; không biến login Customer thành quyền quản lý. API Organizer được kiểm thử bằng company session/membership trong database fixture riêng.

Avatar lưu vào `users.avatar_url`; cover bản nháp lưu vào `events.cover_image_url`, tăng event.version; sản phẩm lưu vào `merchandise_products.image_url` và tăng version của event cha. Catalog đọc cover từ event, fallback URL publication cũ. Không sửa event PUBLISHED bằng upload để vượt quy trình review. `GET /media/avatar` chỉ trả avatar của User hiện tại; `GET /media/config` chỉ trả trạng thái cấu hình, không credential.

## Cấu hình server

BE đọc năm biến `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`. Hỗ trợ tên đã có trong `.env`: `R3_Account_ID`, `R3_ACCESS_KEY_ID`, `R3_SECRET_ACCESS_KEY`, `R3_BUCKET_NAME`, `R3_URL`. Tên `R2_*` ưu tiên khi cùng tồn tại. Không đổi `.env` thật.

`R2_PUBLIC_URL`/`R3_URL` là host đọc ảnh public, có thể dùng URL bucket `r2.dev` ở local hoặc custom domain cho triển khai. Endpoint ký luôn là `https://<account-id>.r2.cloudflarestorage.com`, region `auto`. Credential chỉ ở BE; cần quyền object read/write trên đúng bucket. Không dùng public URL để ký PUT. Cấu hình thiếu một phần làm startup fail với tên trường, không log giá trị.

## CORS bucket — cần cấu hình tại Cloudflare

Bucket → Settings → CORS. Thay origin bên dưới bằng origin FE thực tế (`PUBLIC_APP_URL`, không có path hoặc dấu `/` cuối); giữ các rule đang phục vụ client khác.

```json
[
  {
    "AllowedOrigins": ["http://127.0.0.1:5173"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type", "If-None-Match"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

R2 object credential upload/đọc/xóa object thử được, nhưng API đọc/sửa bucket CORS trả `AccessDenied`; không đổi quyền credential để vượt lỗi. Chủ dự án đã sửa CORS trên dashboard sau khi đối chiếu rule cũ chỉ cho GET từ localhost:3000. Kiểm tra cuối ngày 2026-10-10 thành công: preflight OPTIONS 204 với Origin ứng dụng và Content-Type/If-None-Match, Edge headless upload File trực tiếp bằng presigned PUT trả 200, BE xác minh HEAD/signature và browser hiển thị ảnh public. Các lượt 403 trước đó được giữ trong log tiến độ như lịch sử, không phải trạng thái hiện tại.

Nguồn: [Cloudflare presigned URL](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/), [S3 compatibility và conditional PUT](https://developers.cloudflare.com/r2/api/s3/api/).

## Migration và kiểm chứng

Sau khi chủ dự án lưu rule đúng, lượt thử browser/CORS đã qua như phần trên. Các object/profile/script thử được dọn; không sửa PostgreSQL trong lượt kiểm tra CORS. Lượt này kiểm tra browser File PUT và hiển thị ảnh public, không thử lại login hoặc popup avatar/complete API; phần complete được kiểm chứng bởi 29 kiểm tra API/DB/R2 riêng.

`database/migrations/003-r2-images.sql` chỉ thêm hai cột URL nullable, không sửa dữ liệu cũ. Đã kiểm thử schema cũ → migration trong database riêng, rồi backup local bằng pg_dump custom, kiểm tra pg_restore --list và áp dụng nguyên tử. Backup nằm trong `backups/` được Git ignore, giữ phục vụ khôi phục. Database mới dùng schema.sql đã đồng bộ; không chạy migration 003 lần nữa nếu hai cột đã tồn tại.

29 kiểm tra HTTP/PostgreSQL/R2 live đã qua: auth/Origin, loại/kích thước, receipt sai/hết hạn, chéo User/tổ chức, membership bị thu hồi, DRAFT/version, chữ ký Content-Length/Content-Type/If-None-Match, R2 PUT, chặn overwrite 412, xác minh HEAD/signature, lưu URL/audit của avatar/event/product, tăng version event cha, version conflict và replay hoàn tất avatar. Company provider trong fixture không phải login công ty live. Ảnh thử và DB riêng được dọn sau chạy; không gửi SMTP hoặc đăng nhập Google trong kiểm thử này. FE lint/typecheck/format và Vite build qua; build output tạm được dọn. BE lint/typecheck/build với noEmit và format source qua; npm test/format toàn BE vẫn vướng bộ tests đã bị xóa từ trước.

Chưa xác nhận E2E toàn bộ popup avatar với login live; đã xác nhận browser upload File trực tiếp và hiển thị ảnh public. Signature header là kiểm tra định dạng ban đầu, không phải giải mã/re-encode toàn ảnh hay dịch vụ quét nội dung. Object upload bị bỏ dở hoặc ảnh đã thay thế chưa được tự động xóa; không tự đặt lifecycle xóa cả prefix vì có thể xóa ảnh đang được tham chiếu.

## Version merchandise / ADR-038

purpose=merchandise dùng product.version. Product DRAFT được upload khi event PUBLISHED; complete kiểm tra receipt/quyền như trước và tăng product.version, giữ event.version. Không sửa ảnh sản phẩm đã publish để vượt Admin review; REJECTED cần edit về DRAFT. [44](44-backend-v1-extensions.md).
