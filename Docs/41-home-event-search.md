# Search sự kiện trang chính — ADR-036 / 2026-10-14

Chủ dự án đã chọn **Elasticsearch một instance** cho search/autocomplete Home, PostgreSQL là dữ liệu gốc, Redis cache; dùng tiếng Anh. Đây là ngoại lệ được chấp thuận cho search trong ADR-025, API vẫn Modular Monolith một instance. Không thêm OpenSearch, broker, cluster, replica, API instance hoặc worker service mới.

## Chức năng đã nối

- Ô `Search events, venues, organizers...` trong `Moments Await` gọi API tìm kiếm, không lọc riêng danh sách tối đa100 sự kiện đã tải về Home.
- Tìm tên sự kiện, Organizer, địa điểm và mô tả công khai; xếp hạng tên chính xác → cụm từ → từ khóa có trọng số → tiền tố/N-gram. English analyzer có stemming; fuzzy AUTO từ4 ký tự, prefix_length1/max_expansions25 để giới hạn mở rộng.
- `edge_ngram`2–20 hỗ trợ tiền tố, `ngram`3–12 hỗ trợ phần trong từ của tên sự kiện. Completion suggester của Elasticsearch dùng cấu trúc FST cho gợi ý tiền tố; không dựng thêm Trie riêng trong RAM API hoặc đồng bộ một bản tên sự kiện nữa.
- Gợi ý từ2 ký tự, tối đa6 sự kiện; ArrowUp/Down/Enter/Escape, click để mở preview. FE debounce250ms gợi ý/350ms search, hủy request cũ và kiểm tra khóa query/token để tránh hiển thị response đến muộn.
- FE giữ category/city/sort của giao diện, thêm Best Match, phân trang8 mục và Load more events; trạng thái tải, lỗi/thử lại, rỗng đều tiếng Anh. `q` giữ trong URL. Navbar dẫn đến `/#discover` như trước. Không dịch toàn bộ ứng dụng.
- Preview và trang chi tiết lấy lại public event từ API với Bearer tùy chọn; mở được kết quả nằm ngoài catalog Home và báo unavailable khi sự kiện đã gỡ.

## Hợp đồng API

| GET dưới `/api/v1` | Hành vi |
| --- | --- |
| `/search/events` | Search/filter/sort/pagination, Guest hoặc Bearer JWT hiện hành |
| `/search/events/suggestions` | Cùng bộ lọc, q từ2 ký tự, page1/pageSize6/relevance cố định |

Query strict: q≤120, category slug, city, from/to ISO timezone (`from≤start<to`), minPrice/maxPrice là chuỗi integer minor-unit trong BIGINT, available=`true/false`, sort=`relevance/popular/date_asc/date_desc/price_asc/price_desc`, page1–100000/pageSize1–100. Unknown field, mảng query, client userId/DSL/script bị từ chối. Suggestions q ngắn hơn2 trả `{items:[]}`; FE không gửi các query này.

Response theo envelope chung: `data={items,total,degraded,engine,pagination:{page,pageSize,total,totalPages,hasMore}}`, items dùng Event DTO catalog hiện hành. engine=`elasticsearch` khi có keyword và lấy được candidates, `postgresql` khi không có keyword/không cấu hình/fallback. Lỗi engine có cấu hình trả fallback với degraded=true; không có fuzzy/prefix của ES trong fallback. Trên10000 session candidates trả422 SEARCH_TOO_BROAD, không cắt rồi báo tổng sai. Suggestion là tập ứng viên giới hạn50 hits +30 completion, không dùng tổng gợi ý làm tổng search đầy đủ.

No-store/Vary Authorization; Bearer được gửi thì luôn phải hợp lệ, không hạ xuống Guest khi token sai. JWT/refresh/linking/CSRF/cookie/provider không đổi. Swagger mô tả endpoint thực; frontend không truy cập trực tiếp Elasticsearch hoặc giữ credential engine.

## Dữ liệu gốc, cache và đồng bộ

Mỗi document ứng với một suất: session ID, event ID, fingerprint nội dung, revision đồng bộ, title/Organizer/venue/description/category/city/lịch và completion. Chỉ event PUBLISHED, tổ chức APPROVED, public IDs, đã đến published_at và suất SCHEDULED được chiếu. Không index draft, User/identity/email/phone, booking/payment, attendee/CCCD/QR. Search giới hạn endsAt>now; PG kiểm tra lại điều kiện này.

ES chỉ trả session ID + hash. Redis cache candidates15 giây với key hash keyword/mode/index; không cache Event DTO, quyền, giá, ghế hoặc dữ liệu cá nhân. Mỗi response luôn hydrate PostgreSQL trong một statement cho total + page, áp dụng trạng thái event/org, suất cùng city/date/price/ghế và organization_blocks của actor server. Sort popular đếm vé VALID/USED của booking CONFIRMED. Chặn/gỡ/giá/tồn kho thay đổi có hiệu lực tại PG ngay khi commit, không chờ TTL. Fingerprint khớp nội dung/lịch hiện hành loại kết quả text cũ khi nội dung đổi; newly matching event có thể chờ worker + cache≤15s, đây là eventual indexing có chủ đích.

Migration015 không thêm bảng/cột: dùng outbox_messages hiện có, type SEARCH_EVENT_SYNC, aggregate EVENT, payload `{}`, dedupe event/transaction. Trigger event/session/org/venue/category cùng transaction với mutation; category slug và org public_id cũng đồng bộ. Worker notifications cùng codebase xử lý mỗi job ngoài transaction mạng: reserve lease1 phút, projection PG, ES write/purge, ack/retry PG. External revision là DB clock microseconds; failed write retained/backoff2–300s, tối đa8 lần rồi FAILED. Runner heartbeat ghi SEARCH_INDEX_WRITE_FAILED; không log raw ES error/credential. Không đổi dispatcher notification hiện có.

## Cấu hình và vận hành local

Elasticsearch9.5.5 được pin image digest trong BE/compose.search.yml (overlay trên compose.yml): single-node, **1 shard/0 replicas**, heap512MB, container giới hạn2GB RAM, volume elasticsearch-data lưu chỉ mục. Cấu hình search là overlay riêng để infra:redis không bắt buộc có credential ES; infra:search:stop chỉ dừng ES, infra:stop giữ hành vi Redis hiện có. Security/auth bật; local HTTP chỉ bind127.0.0.1:9200. Ngoài development/testing hoặc ngoài loopback bắt buộc HTTPS. Production nên dùng API key quyền riêng index và certificate hợp lệ; profile compose này chỉ cho local, chưa xác nhận staging/production hoặc benchmark tải.

Trong BE, Node24:

```powershell
npm.cmd run search:setup
npm.cmd run infra:search
# DB có014: backup/review rồi áp dụng015 một lần; DB rỗng dùng schema.sql.
npm.cmd run search:reindex
npm.cmd run start:monolith
```

search:setup chỉ bổ sung biến thiếu vào .env development, tạo secret ngẫu nhiên ngoài Git, không in secret/ghi đè cấu hình sẵn. Các biến: ELASTICSEARCH_URL, ELASTICSEARCH_USERNAME+PASSWORD **hoặc** ELASTICSEARCH_API_KEY, ELASTICSEARCH_INDEX mặc định eventix-events-v1. Không nhúng credential trong URL. Khi dùng API key có sẵn, cấu hình bằng tay theo .env.example; không dùng helper Basic local để trộn hai kiểu credential. Compose local bootstrap cần ELASTICSEARCH_PASSWORD.

search:reindex enqueue toàn bộ events rồi đọc lại trạng thái công khai từ PG để rebuild/purge; chỉ dùng một tiến trình đồng bộ khi reindex (dừng notifications worker trong maintenance). Lỗi job làm lệnh thất bại, không báo đã đồng bộ khi mạng lỗi. Không xóa index ứng dụng để thử nghiệm. Mapping contract event-search-v1 được kiểm tra, không ghi đè mapping khác; đổi analyzer cần index phiên bản mới/reindex trong cùng single-node, không tự rollout alias/cluster.

Readiness kiểm tra enqueue_search_event và Elasticsearch index khi có cấu hình, cùng PG/Redis/worker hiện hành. GET search có fallback, readiness vẫn phản ánh phụ thuộc hỏng. Outbox FAILED cần kiểm tra lỗi/cấu hình và retry vận hành; không tự bỏ job hoặc dùng index làm nguồn sự thật.

## Kiểm chứng và khôi phục

Check cuối: BE95 unit/HTTP/config/architecture tests + lint/typecheck/build/format/secret guard qua; FE lint/typecheck/build/format qua (bundle chính vẫn trên500kB, không lỗi). Smoke read-only DB/index ứng dụng local: search/suggestions200, engine elasticsearch/degraded false, Redis cache thật TTL15s,14 public documents đối chiếu PG, health/ready200, Bearer sai401. Không benchmark tải hoặc rollout staging/production.

- PostgreSQL fresh + populated upgrades007–015 đã khớp. 55 tests PG/ES qua trước browser; 56 tests qua khi bật SEARCH_TEST_BROWSER=1 (một commerce browser ngoài search bỏ qua).
- ES thật: title/org/venue, typo, prefix/completion, pagination, cached hashes, live price/block/archive, draft không index, failure retained/retry, HTTP/invalid auth/strict query/fallback/OpenAPI. Edge headless thật: search, bàn phím/autocomplete, typo, không kết quả, load more, preview ngoài Home catalog, unavailable sau archive và lỗi HTTP/Retry search.
- npm run test:search dùng PG cô lập, API key15 phút chỉ có quyền trên index fixture ngẫu nhiên; cuối lượt dọn index/key, giữ index ứng dụng. CI bổ sung single-node ES fixture, chưa tuyên bố workflow remote đã chạy. SEARCH_TEST_BROWSER=1 chỉ dùng local Windows có Edge và Fe/dist build hiện hành.
- DB local đã backup before-015-1791977547583.dump (257083 bytes, pg_restore --list qua), apply015 trong transaction, vẫn47 bảng; fingerprint toàn bộ bảng ngoài outbox giữ nguyên. Không chạy015 lại trên DB này. DB rỗng dùng schema.sql, không chạy migration lại.
- Backup nằm ngoài Git trong backups/. Khi cần rollback, phục hồi backup vào DB riêng cùng release trước015; không drop lịch sử mới. Index là projection có thể dựng lại từ PG. Giữ Docker ES/volume là hạ tầng sản phẩm được duyệt; server/browser/profile/index/key/PG fixture được dọn sau test.

Nguồn thiết kế engine: [Docker single-node](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/install-elasticsearch-docker-basic), [multi-match](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-multi-match-query), [completion suggester](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-suggesters). Không triển khai semantic/AI search hoặc hỗ trợ phân tích tiếng Việt chuyên biệt.
