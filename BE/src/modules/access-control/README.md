# Access control

Admin RBAC API ở `/api/v1/admin/rbac`, React UI `/admin/rbac`. Quyết định và hợp đồng tại [Docs46](../../../../Docs/46-dynamic-rbac.md), ADR-040. Dùng pg transaction chung cho quyền, version, mutation, audit và idempotency; không chuyển các luồng nghiệp vụ sang Prisma.

Role tùy chỉnh bổ sung quyền trong cùng nhóm CUSTOMER/ORGANIZER/ADMIN, không giảm quyền gốc. Ba role gốc/permission catalog được bảo vệ trong API. Chỉ ADMIN + rbac.manage; write cần recent authentication 5 phút và reason, không tự sửa quyền, không thu hồi Admin cuối. Không sửa membership/ownership/report/onboarding/token/cookie/provider.

Migration018 bổ sung metadata role và users.roles_version; không thêm bảng hay cấp UserRole. SQL ngoài ứng dụng là quyền vận hành đặc biệt, không được coi là đường quản trị thông thường. Test PostgreSQL, HTTP và browser dùng fixture riêng.
