# Media

Presigned PUT URL cho JPEG/PNG/WebP tối đa 5 MB, hạn 5 phút. Client upload File trực tiếp tới R2 rồi gọi complete; PostgreSQL chỉ lưu URL. Hợp đồng, quyền, CORS, migration và giới hạn tại [Docs/28](../../../../Docs/28-r2-image-upload.md).

Route xác thực Bearer/Origin và rate limit; service điều phối quyền, receipt và transaction; repository chỉ SQL theo connection; storage ký URL/receipt và đọc HEAD/signature ảnh. Không nhận binary multipart qua API, không tin URL/key/owner do client khai.
