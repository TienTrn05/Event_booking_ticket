# 45. Prisma thử nghiệm và RBAC hiện hành

Cập nhật sau yêu cầu tiếp theo: phần quản trị role động đã được chốt/triển khai riêng tại [Docs46](46-dynamic-rbac.md)/ADR-040. Các đoạn “chưa có RBAC động” dưới đây mô tả thời điểm pilot Prisma, không phải trạng thái của yêu cầu mới. Phạm vi Prisma vẫn chỉ preference Organizer.

Chủ dự án yêu cầu ngày 2026-10-15: sửa regression BE, ổn định test và thử Prisma ở một module CRUD ít rủi ro. ADR-039 giữ Modular Monolith một API và các worker hiện có. Đây chưa là quyết định chuyển toàn BE sang ORM.

## RBAC đã có

`users → user_roles → roles → role_permissions → permissions` là nguồn cấp quyền. Một User có nhiều role được cấp tường minh. `users.registration_role` lưu lựa chọn CUSTOMER/ORGANIZER lúc onboarding, không dùng làm quyền truy cập. JWT chứng minh User/session; BE vẫn đọc quyền DB hiện hành. Không thay grant hoặc tạo Admin thật.

RBAC chỉ là điều kiện chung. Organizer còn cần membership đúng tổ chức, ACTIVE/Organization APPROVED cho vận hành. Customer cần sở hữu đơn/vé; Admin can thiệp cần report được giao đúng tài nguyên. API chỉnh role/permission tùy ý chưa thuộc yêu cầu hiện tại.

## Phạm vi Prisma

- Prisma Client/CLI/adapter-pg **7.10.0**, pin manifest/lockfile. Module thử nghiệm là preference Customer ẩn/bỏ ẩn Organizer: PUT/GET/DELETE `/api/v1/users/me/blocked-organizers` hiện có, không endpoint/permission mới.
- Repository dùng createMany/skipDuplicates, deleteMany, findMany/count và kiểu sinh từ model. PUT lặp không đổi thời điểm ẩn; DELETE lặp thành công. List phân trang/sort và các field DTO giữ nguyên; blockedAt là ISO UTC.
- [Schema Prisma](../BE/prisma/schema.prisma) là **projection client giới hạn**, chỉ organization_blocks và các cột organizations cần đọc. Không đại diện DDL 51 bảng. Không chạy Prisma db push/Migrate từ projection này. SQL schema/migrations001–017, trigger/FK/CHECK/unique vẫn quản lý cấu trúc DB; không migration DB mới hoặc bảng `_prisma_migrations`.
- `npm ci` sinh client qua postinstall; chạy `npm run prisma:generate` sau khi sửa model. Client ở node_modules, không commit. `npm run check` thêm prisma:validate. Runtime giữ DB_* hiện có, không thêm credential/DATABASE_URL vào schema.

## Transaction và vòng đời

withPrismaTransaction dùng PrismaPg với **cùng pg pool hiện có**, không tăng connection budget. Mỗi use case có một Prisma transaction READ COMMITTED, UTC và timeout hữu hạn. Guard profile/onboarding/Customer/Organization dùng SQL cũ qua SqlReader trên chính transaction Prisma; giá trị vẫn là bind parameters.

SqlReader chỉ phục vụ SELECT/SELECT FOR SHARE/UPDATE để đọc/lấy khóa, không làm adapter cho repository ghi SQL. Callback không gọi pg pool, root Prisma client hoặc mở transaction thứ hai. Regression đối chiếu backend PID/transaction ID, đọc được dữ liệu ORM chưa commit và rollback xác nhận ranh giới này. List lấy User lock như mutation để items/count nhất quán khi đổi preference đồng thời.

API shutdown disconnect Prisma rồi đóng pool; Prisma không sở hữu pool ngoài. Hold/payment/refund/ticket và worker tiếp tục dùng pg. Production build cần cài đủ tooling/sinh client trước khi bỏ devDependencies; chưa có deployment production trong lượt này.

## Sửa regression

- Refresh khóa token trước khi tính expiry bằng clock_timestamp; profile lấy User→Session/Identity locks rồi kiểm tra trạng thái/hạn. JWT10 phút/refresh7 ngày tuyệt đối/rotation/provider/linking/cookie/CSRF giữ nguyên.
- Q-037: chủ dự án xác nhận giữ chặn người từng là thành viên. Lời mời INVITED hoặc decline/revoke chưa từng chấp nhận không chặn review của người mua đủ điều kiện. Status/approved_at và lịch sử membership.accept phân biệt tái mời, vì reinvite xóa approval trước đó. Audit chỉ tiếp tục chặn self-review, không cấp quyền.
- Recovery đợi mọi candidate poll hoàn tất rồi báo lỗi an toàn nếu có thất bại để worker tăng failure counter; candidate khác vẫn xử lý tiền. Không log payload/credential thô.
- Fixture SUCCESS refund lấy giờ DB đầy đủ microsecond. Fixture NEW_SALE_WAVE lấy deadline từ starts_at đã lưu thay vì tính tương đối từ giờ Node lúc test đang chạy.

## Đánh giá bảo trì

Cùng định dạng Prettier, OrganizerBlockRepository **29→36 dòng**: thay ba câu SQL bằng ORM có kiểu sinh tự động, bỏ kiểu row tự khai báo. Thêm projection và helper transaction/SqlReader làm tổng mã tích hợp tăng. Lợi ích là kiểm tra tên field/select/quan hệ lúc biên dịch và sửa CRUD; chưa có bằng chứng nhanh hơn hoặc ít dòng hơn toàn hệ thống.

List SQL cũ dùng một CTE; ORM dùng findMany/count và tải quan hệ, có thể tăng số query. Preference cá nhân nhỏ phù hợp thử nghiệm; không suy kết quả sang search/thống kê hoặc ghế nóng. Chỉ mở rộng khi lợi ích bảo trì vượt chi phí mapping/transaction/truy vấn.

Prisma CLI có advisory dependency gián tiếp khi cài; override deepmerge-ts8.0.2/mysql2 3.24.6 đã qua generate/validate/typecheck và npm audit0. Kiểm tra lại override khi nâng Prisma, không audit fix --force đổi major.

Regression chính thức: expiry sau chờ khóa qua pg/Prisma; poll lỗi cùng candidate nhận tiền; review khi đang mời/đã decline/cựu thành viên tái mời; rollback/cùng connection/FK; phân trang/ownership và thu hồi Customer role dù registration_role còn giá trị. Kết quả cổng cuối và cleanup tại [Docs26](26-auth-progress.md). Không dùng DB/provider/tiền thật; chưa nghiệm thu production/tải lớn hoặc RBAC động.

Nguồn: [Prisma 7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions), [driver PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [SQL migration cho tính năng DB](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features).
