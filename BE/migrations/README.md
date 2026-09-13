# Migration

Chưa tự chạy migration khi khởi động API. `database/schema.sql` ở gốc dành cho database rỗng; không chạy trên DB có dữ liệu để nâng cấp. Migration runner và tài khoản DDL riêng sẽ được bổ sung khi bắt đầu triển khai nghiệp vụ. `npm run db:check` chỉ SELECT 1, không sửa schema hoặc grants.
