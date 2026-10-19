-- Dữ liệu demo cho Public Web. Chọn đúng database trong DBeaver trước khi chạy script.
-- ID từ 900000 trở lên được dành cho fixture này; không dùng trên database có dữ liệu thật.
SET client_encoding = 'UTF8';
SET TIME ZONE 'UTC';
BEGIN;

INSERT INTO users (id, display_name, status) VALUES
(900001, 'Demo Admin', 'ACTIVE'),
(900101, 'Sơn Tùng M-TP', 'ACTIVE'), (900102, 'Đen Vâu', 'ACTIVE'),
(900103, 'Monsoon Festival', 'ACTIVE'), (900104, 'VCCA', 'ACTIVE'),
(900105, 'V.League Official', 'ACTIVE'), (900106, 'Tech Nation VN', 'ACTIVE'),
(900107, 'Saigon Creative', 'ACTIVE'), (900108, 'Craft Vietnam', 'ACTIVE'),
(900109, 'Live Nation Vietnam', 'ACTIVE'), (900110, 'Innovation Hub VN', 'ACTIVE'),
(900111, 'Aperture Academy', 'ACTIVE'), (900112, 'Midnight Events', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO external_identities
  (id, user_id, provider, subject, email_canonical, email_verified_at, verified_at)
VALUES
(901101,900101,'COMPANY_EMAIL','events@sontungmtp.demo','events@sontungmtp.demo','2026-08-01','2026-08-01'),
(901102,900102,'COMPANY_EMAIL','events@denvau.demo','events@denvau.demo','2026-08-01','2026-08-01'),
(901103,900103,'COMPANY_EMAIL','events@monsoon.demo','events@monsoon.demo','2026-08-01','2026-08-01'),
(901104,900104,'COMPANY_EMAIL','events@vcca.demo','events@vcca.demo','2026-08-01','2026-08-01'),
(901105,900105,'COMPANY_EMAIL','events@vleague.demo','events@vleague.demo','2026-08-01','2026-08-01'),
(901106,900106,'COMPANY_EMAIL','events@technation.demo','events@technation.demo','2026-08-01','2026-08-01'),
(901107,900107,'COMPANY_EMAIL','events@saigoncreative.demo','events@saigoncreative.demo','2026-08-01','2026-08-01'),
(901108,900108,'COMPANY_EMAIL','events@craftvietnam.demo','events@craftvietnam.demo','2026-08-01','2026-08-01'),
(901109,900109,'COMPANY_EMAIL','events@livenation.demo','events@livenation.demo','2026-08-01','2026-08-01'),
(901110,900110,'COMPANY_EMAIL','events@innovationhub.demo','events@innovationhub.demo','2026-08-01','2026-08-01'),
(901111,900111,'COMPANY_EMAIL','events@aperture.demo','events@aperture.demo','2026-08-01','2026-08-01'),
(901112,900112,'COMPANY_EMAIL','events@midnight.demo','events@midnight.demo','2026-08-01','2026-08-01')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id, granted_by)
SELECT 900001, id, NULL FROM roles WHERE code = 'ADMIN'
ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id, granted_by)
SELECT u.id, r.id, 900001 FROM users u CROSS JOIN roles r
WHERE u.id BETWEEN 900101 AND 900112 AND r.code = 'ORGANIZER'
ON CONFLICT DO NOTHING;

INSERT INTO organizations
  (id,name,contact_domain,applicant_user_id,applicant_identity_id,applicant_identity_provider,status,reviewed_by,reviewed_at)
VALUES
(902001,'Sơn Tùng M-TP','sontungmtp.demo',900101,901101,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902002,'Đen Vâu','denvau.demo',900102,901102,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902003,'Monsoon Festival','monsoon.demo',900103,901103,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902004,'VCCA','vcca.demo',900104,901104,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902005,'V.League Official','vleague.demo',900105,901105,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902006,'Tech Nation VN','technation.demo',900106,901106,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902007,'Saigon Creative','saigoncreative.demo',900107,901107,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902008,'Craft Vietnam','craftvietnam.demo',900108,901108,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902009,'Live Nation Vietnam','livenation.demo',900109,901109,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902010,'Innovation Hub VN','innovationhub.demo',900110,901110,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902011,'Aperture Academy','aperture.demo',900111,901111,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02'),
(902012,'Midnight Events','midnight.demo',900112,901112,'COMPANY_EMAIL','APPROVED',900001,'2026-08-02')
ON CONFLICT DO NOTHING;

INSERT INTO organization_memberships
  (id,organization_id,user_id,member_identity_id,member_identity_provider,status,approved_by,approved_at)
SELECT 903000 + (id - 902000), id, applicant_user_id, applicant_identity_id,
  applicant_identity_provider, 'ACTIVE', 900001, '2026-08-02'
FROM organizations WHERE id BETWEEN 902001 AND 902012
ON CONFLICT DO NOTHING;

UPDATE organizations o SET public_id=p.public_id,avatar_url=p.avatar_url,summary=p.summary,category_label=p.category_label,featured_rank=p.featured_rank,profile_created_at=COALESCE(o.profile_created_at,CURRENT_TIMESTAMP),profile_updated_at=CURRENT_TIMESTAMP FROM (VALUES (902001,'o1','https://images.pexels.com/photos/12216243/pexels-photo-12216243.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Đơn vị tổ chức các chương trình âm nhạc và trải nghiệm dành cho cộng đồng người hâm mộ.','Music',1),
(902002,'o2','https://images.pexels.com/photos/6201175/pexels-photo-6201175.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Đơn vị tổ chức các đêm nhạc và dự án văn hóa đương đại.','Music',2),
(902003,'o3','https://images.pexels.com/photos/17373843/pexels-photo-17373843.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Nhà tổ chức lễ hội âm nhạc và hoạt động cộng đồng.','Festivals',3),
(902004,'o4','https://images.pexels.com/photos/2559741/pexels-photo-2559741.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Không gian dành cho nghệ thuật và triển lãm đương đại.','Arts',4),
(902005,'o5','https://images.pexels.com/photos/30651230/pexels-photo-30651230.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Đơn vị vận hành và giới thiệu các sự kiện thể thao.','Sports',5),
(902006,'o6','https://images.pexels.com/photos/29180747/pexels-photo-29180747.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Cộng đồng hội nghị công nghệ và đổi mới sáng tạo.','Technology',6),
(902007,'o7','https://images.pexels.com/photos/15476611/pexels-photo-15476611.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Nhà tổ chức các hoạt động nghệ thuật đường phố.','Arts',7),
(902008,'o8','/images/art.jpg','Đơn vị tổ chức workshop thủ công và trải nghiệm sáng tạo.','Workshops',8),
(902009,'o9','https://images.pexels.com/photos/5193526/pexels-photo-5193526.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Nhà tổ chức chương trình biểu diễn quốc tế.','Music',NULL),
(902010,'o10','https://images.pexels.com/photos/1708909/pexels-photo-1708909.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Cộng đồng công nghệ và robotics.','Technology',NULL),
(902011,'o11','https://images.pexels.com/photos/39201792/pexels-photo-39201792.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Đơn vị đào tạo và workshop nhiếp ảnh.','Workshops',NULL),
(902012,'o12','https://images.pexels.com/photos/30247038/pexels-photo-30247038.jpeg?auto=compress&cs=tinysrgb&h=200&w=200','Nhà tổ chức lễ hội và chương trình đếm ngược.','Festivals',NULL)) AS p(organization_id,public_id,avatar_url,summary,category_label,featured_rank) WHERE o.id=p.organization_id AND o.public_id IS NULL;

INSERT INTO event_categories (name,slug,is_active) VALUES
('Music','music',TRUE),('Technology','technology',TRUE),('Sports','sports',TRUE),
('Arts','arts',TRUE),('Workshops','workshops',TRUE),('Festivals','festivals',TRUE)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

INSERT INTO city_profiles (city,display_name,image_url,sort_order) VALUES
('Ho Chi Minh City','Hồ Chí Minh','https://images.pexels.com/photos/15476611/pexels-photo-15476611.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',1),
('Ha Noi','Hà Nội','https://images.pexels.com/photos/30215324/pexels-photo-30215324.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',2),
('Da Nang','Đà Nẵng','https://images.pexels.com/photos/17373843/pexels-photo-17373843.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',3),
('Hue','Huế','https://images.pexels.com/photos/2559741/pexels-photo-2559741.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',4),
('Hai Phong','Hải Phòng','https://images.pexels.com/photos/30651230/pexels-photo-30651230.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',5)
ON CONFLICT DO NOTHING;

INSERT INTO venues
  (id,catalog_code,name,address,city,timezone,canvas_width,canvas_height,bounds_json,max_capacity,status,version)
VALUES
(904001,'DEMO-MYDINH','My Dinh National Stadium','Mỹ Đình, Nam Từ Liêm','Ha Noi','Asia/Ho_Chi_Minh',120,80,jsonb_build_object('type','rectangle','x',0,'y',0,'width',120,'height',80),40000,'ACTIVE',1),
(904002,'DEMO-THONGNHAT-PARK','Thong Nhat Park','Hai Bà Trưng','Ho Chi Minh City','Asia/Ho_Chi_Minh',120,80,jsonb_build_object('type','rectangle','x',0,'y',0,'width',120,'height',80),12000,'ACTIVE',1),
(904003,'DEMO-SECC','Saigon Exhibition Center','Quận 7','Ho Chi Minh City','Asia/Ho_Chi_Minh',100,60,jsonb_build_object('type','rectangle','x',0,'y',0,'width',100,'height',60),5000,'ACTIVE',1),
(904004,'DEMO-VCCA','Vincom Center for Contemporary Art','Thanh Xuân','Ha Noi','Asia/Ho_Chi_Minh',80,50,jsonb_build_object('type','rectangle','x',0,'y',0,'width',80,'height',50),2000,'ACTIVE',1),
(904005,'DEMO-BATTRANG','Bat Trang Ceramic Village','Gia Lâm','Ha Noi','Asia/Ho_Chi_Minh',80,50,jsonb_build_object('type','rectangle','x',0,'y',0,'width',80,'height',50),800,'ACTIVE',1),
(904006,'DEMO-ARMY','Army Stadium','Tân Bình','Ha Noi','Asia/Ho_Chi_Minh',110,70,jsonb_build_object('type','rectangle','x',0,'y',0,'width',110,'height',70),20000,'ACTIVE',1),
(904007,'DEMO-ARIYANA','Ariyana Convention Center','Ngũ Hành Sơn','Da Nang','Asia/Ho_Chi_Minh',100,60,jsonb_build_object('type','rectangle','x',0,'y',0,'width',100,'height',60),3500,'ACTIVE',1),
(904008,'DEMO-THONGNHAT-STADIUM','Thong Nhat Stadium','Quận 10','Ho Chi Minh City','Asia/Ho_Chi_Minh',110,70,jsonb_build_object('type','rectangle','x',0,'y',0,'width',110,'height',70),18000,'ACTIVE',1),
(904009,'DEMO-NGUYENHUE','Nguyen Hue Walking Street','Quận 1','Ho Chi Minh City','Asia/Ho_Chi_Minh',140,40,jsonb_build_object('type','rectangle','x',0,'y',0,'width',140,'height',40),15000,'ACTIVE',1),
(904010,'DEMO-SOFITEL','Sofitel Saigon Plaza','Quận 1','Ho Chi Minh City','Asia/Ho_Chi_Minh',80,50,jsonb_build_object('type','rectangle','x',0,'y',0,'width',80,'height',50),600,'ACTIVE',1),
(904011,'DEMO-BAKHUONG','Ba Khuong Lake Park','Liên Chiểu','Da Nang','Asia/Ho_Chi_Minh',140,90,jsonb_build_object('type','rectangle','x',0,'y',0,'width',140,'height',90),25000,'ACTIVE',1)
ON CONFLICT DO NOTHING;

CREATE TEMPORARY TABLE demo_event_seed (
  event_id BIGINT PRIMARY KEY, organization_id BIGINT NOT NULL,
  venue_id BIGINT NOT NULL, layout_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL, review_id BIGINT NOT NULL,
  public_id VARCHAR(80) NOT NULL, title VARCHAR(255) NOT NULL, category_slug VARCHAR(160) NOT NULL,
  description TEXT NOT NULL, image_url VARCHAR(1000) NOT NULL, starts_at TIMESTAMPTZ NOT NULL,
  price_minor BIGINT NOT NULL, admission_type VARCHAR(16) NOT NULL,
  catalog_status VARCHAR(24) NOT NULL, card_badge VARCHAR(80) NULL,
  featured_rank SMALLINT NULL, spotlight_rank SMALLINT NULL
) ON COMMIT DROP;
INSERT INTO demo_event_seed VALUES
(905001,902009,904001,906001,907001,908001,'fe1','Coldplay: Music of the Spheres World Tour','music','Đêm nhạc sân vận động do Live Nation Vietnam tổ chức.','https://images.pexels.com/photos/5193526/pexels-photo-5193526.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-11-15 12:00:00',1800000,'NUMBERED','ON_SALE','Hot',1,NULL),
(905002,902001,904001,906002,907002,908002,'fe2','Sơn Tùng M-TP Live Concert 2026','music','Live concert và trải nghiệm dành cho cộng đồng người hâm mộ.','https://images.pexels.com/photos/30215324/pexels-photo-30215324.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-10-18 13:00:00',850000,'NUMBERED','FEW_LEFT','Trending',2,NULL),
(905003,902003,904002,906003,907003,908003,'fe3','Monsoon Music Festival 2026','festivals','Lễ hội âm nhạc ngoài trời với nhiều sân khấu và hoạt động cộng đồng.','https://images.pexels.com/photos/17373843/pexels-photo-17373843.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-11-22 07:00:00',980000,'QUANTITY','ON_SALE','Editor Pick',3,NULL),
(905004,902005,904001,906004,907004,908004,'fe4','Manchester United vs Vietnam All Stars','sports','Sự kiện bóng đá giao hữu tại sân vận động Mỹ Đình.','https://images.pexels.com/photos/30651230/pexels-photo-30651230.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-12-01 12:30:00',1500000,'NUMBERED','FEW_LEFT','Hot',4,NULL),
(905005,902006,904003,906005,907005,908005,'e2','Vietnam Tech Summit 2026','technology','Hội nghị công nghệ dành cho doanh nghiệp và cộng đồng phát triển sản phẩm.','https://images.pexels.com/photos/29180747/pexels-photo-29180747.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-11-05 02:00:00',1200000,'QUANTITY','ON_SALE','Official Partner',NULL,1),
(905006,902004,904004,906006,907006,908006,'e4','Contemporary Art Exhibition: Boundless','arts','Triển lãm nghệ thuật đương đại tại VCCA.','https://images.pexels.com/photos/2559741/pexels-photo-2559741.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-09-25 12:00:00',320000,'QUANTITY','ON_SALE',NULL,NULL,NULL),
(905007,902008,904005,906007,907007,908007,'e6','Masterclass: Modern Pottery Techniques','workshops','Workshop thực hành kỹ thuật gốm hiện đại.','/images/art.jpg','2026-10-10 02:00:00',450000,'QUANTITY','ON_SALE',NULL,NULL,NULL),
(905008,902002,904006,906008,907008,908008,'u1','Đen Vâu Live Concert','music','Đêm nhạc trực tiếp do Đen Vâu tổ chức.','https://images.pexels.com/photos/13230484/pexels-photo-13230484.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-10-25 12:00:00',650000,'NUMBERED','ON_SALE',NULL,NULL,NULL),
(905009,902010,904007,906009,907009,908009,'u2','AI & Robotics Innovation Forum','technology','Diễn đàn về trí tuệ nhân tạo và robotics.','https://images.pexels.com/photos/1708909/pexels-photo-1708909.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-11-08 02:00:00',1100000,'QUANTITY','COMING_SOON','National Event',NULL,2),
(905010,902005,904008,906010,907010,908010,'u3','V.League Championship Final 2026','sports','Trận chung kết giải bóng đá V.League 2026.','https://images.pexels.com/photos/32471037/pexels-photo-32471037.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-12-15 12:00:00',550000,'NUMBERED','FEW_LEFT','Partner Event',NULL,3),
(905011,902007,904009,906011,907011,908011,'u4','Street Art & Culture Festival','arts','Ngày hội nghệ thuật đường phố và văn hóa sáng tạo.','https://images.pexels.com/photos/15476611/pexels-photo-15476611.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-10-30 12:00:00',280000,'QUANTITY','ON_SALE','Sponsored',NULL,4),
(905012,902011,904010,906012,907012,908012,'u5','Photography Masterclass with National Geographic','workshops','Masterclass nhiếp ảnh dành cho người yêu hình ảnh.','https://images.pexels.com/photos/39201792/pexels-photo-39201792.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-11-12 02:00:00',750000,'QUANTITY','ON_SALE',NULL,NULL,NULL),
(905013,902012,904011,906013,907013,908013,'u6','Countdown 2027 New Year Festival','festivals','Lễ hội đếm ngược chào năm mới tại Đà Nẵng.','https://images.pexels.com/photos/30247038/pexels-photo-30247038.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','2026-12-31 12:00:00',1200000,'QUANTITY','COMING_SOON',NULL,NULL,NULL);

INSERT INTO events (id,organization_id,created_by,category_id,title,slug,description,status,version)
SELECT d.event_id,d.organization_id,o.applicant_user_id,c.id,d.title,d.public_id,d.description,'DRAFT',0
FROM demo_event_seed d JOIN organizations o ON o.id=d.organization_id
JOIN event_categories c ON c.slug=d.category_slug
ON CONFLICT DO NOTHING;

INSERT INTO seat_layouts
  (id,organization_id,event_id,venue_id,venue_version,version,status,geometry_json,bounds_snapshot,canvas_width,canvas_height,capacity_snapshot,frozen_at)
SELECT d.layout_id,d.organization_id,d.event_id,d.venue_id,v.version,1,'FROZEN',
  jsonb_build_object('type','demo-catalog-layout'),v.bounds_json,v.canvas_width,v.canvas_height,v.max_capacity,'2026-08-03'
FROM demo_event_seed d JOIN venues v ON v.id=d.venue_id
ON CONFLICT DO NOTHING;

INSERT INTO event_sessions
  (id,event_id,venue_id,layout_id,starts_at,ends_at,timezone,sale_opens_at,sale_closes_at,counter_opens_at,counter_closes_at,admission_opens_at,admission_closes_at,status,version)
SELECT d.session_id,d.event_id,d.venue_id,d.layout_id,d.starts_at,d.starts_at + INTERVAL '4 hours',
  'Asia/Ho_Chi_Minh','2026-08-05',d.starts_at - INTERVAL '1 hour',
  d.starts_at - INTERVAL '3 hours',d.starts_at + INTERVAL '1 hour',
  d.starts_at - INTERVAL '2 hours',d.starts_at + INTERVAL '4 hours','SCHEDULED',0
FROM demo_event_seed d
ON CONFLICT DO NOTHING;

INSERT INTO event_reviews
  (id,event_id,event_version,submitted_by,submitted_at,expires_at,earliest_session_starts_at,submission_cutoff_at,calendar_timezone,snapshot_json,status,decided_by,decided_at)
SELECT d.review_id,d.event_id,0,o.applicant_user_id,'2026-08-03','2026-08-18',d.starts_at,'2026-08-03',
  'Asia/Ho_Chi_Minh',jsonb_build_object('fixture','public-catalog','eventId',d.public_id),'APPROVED',900001,'2026-08-04'
FROM demo_event_seed d JOIN organizations o ON o.id=d.organization_id
ON CONFLICT DO NOTHING;

UPDATE events e
SET status = 'PUBLISHED', approved_review_id = d.review_id,
    approved_event_version = 0, approval_status = 'APPROVED'
FROM demo_event_seed d
WHERE d.event_id = e.id;

UPDATE events e SET public_id=d.public_id,display_name=d.title,publication_cover_image_url=d.image_url,card_badge=d.card_badge,admission_type=d.admission_type,ticketing_mode=d.admission_type,catalog_status=d.catalog_status,starting_price_minor=d.price_minor,currency='VND',featured_rank=d.featured_rank,spotlight_rank=d.spotlight_rank,reopening_note=NULL,published_at='2026-08-05',publication_created_at=CURRENT_TIMESTAMP,publication_updated_at=CURRENT_TIMESTAMP FROM demo_event_seed d WHERE e.id=d.event_id AND e.public_id IS NULL;

INSERT INTO merchandise_products
  (id,public_id,event_id,organization_id,name,description,image_url,price_minor,currency,badge,requires_ticket,status,sort_order)
VALUES
(909001,'m1',905002,902001,'Sơn Tùng M-TP Tour 2026 T-Shirt','Áo thun thuộc bộ sưu tập chính thức của sự kiện.','https://images.pexels.com/photos/13632832/pexels-photo-13632832.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',350000,'VND','Best Seller',FALSE,'PUBLISHED',1),
(909002,'m2',905002,902001,'Sơn Tùng M-TP Hoodie — Sky Tour','Hoodie phiên bản giới hạn của chương trình.','https://images.pexels.com/photos/14389775/pexels-photo-14389775.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',650000,'VND','Limited',FALSE,'PUBLISHED',2),
(909003,'m3',905002,902001,'Sơn Tùng M-TP Lightstick V2','Lightstick dành cho đêm diễn.','https://images.pexels.com/photos/29755921/pexels-photo-29755921.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',420000,'VND','New',TRUE,'PUBLISHED',3),
(909004,'m4',905008,902002,'Đen Vâu Vinyl — Trời Làm Trời Mưa','Đĩa vinyl phiên bản sưu tầm.','https://images.pexels.com/photos/5764281/pexels-photo-5764281.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',680000,'VND','Limited',FALSE,'PUBLISHED',4),
(909005,'m5',905008,902002,'Đen Vâu Tote Bag — Làm','Túi vải thuộc bộ sưu tập của sự kiện.','https://images.pexels.com/photos/1214212/pexels-photo-1214212.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',180000,'VND',NULL,FALSE,'PUBLISHED',5),
(909006,'m6',905003,902003,'Monsoon Festival 2026 Wristband','Vòng tay lưu niệm của lễ hội.','https://images.pexels.com/photos/27694129/pexels-photo-27694129.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',120000,'VND','New',TRUE,'PUBLISHED',6),
(909007,'m7',905003,902003,'Monsoon Festival Vinyl Edition','Vinyl phiên bản lễ hội.','https://images.pexels.com/photos/31805824/pexels-photo-31805824.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',580000,'VND','Best Seller',FALSE,'PUBLISHED',7),
(909008,'m8',905010,902005,'V.League Official T-Shirt 2026','Áo thun chính thức mùa giải 2026.','https://images.pexels.com/photos/20248584/pexels-photo-20248584.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',290000,'VND','New',FALSE,'PUBLISHED',8),
(909009,'m9',905011,902007,'Saigon Creative Art Print Set','Bộ art print của ngày hội sáng tạo.','https://images.pexels.com/photos/908965/pexels-photo-908965.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',420000,'VND',NULL,FALSE,'PUBLISHED',9),
(909010,'m10',905007,902008,'Craft Vietnam Pottery DIY Kit','Bộ dụng cụ thực hành gốm tại nhà.','/images/art.jpg',290000,'VND','New',FALSE,'PUBLISHED',10)
ON CONFLICT DO NOTHING;

INSERT INTO blog_articles
  (id,slug,title,excerpt,body_json,image_url,category,read_minutes,status,published_at)
VALUES
(910001,'merchandise','Mang một chút kỷ niệm về nhà.','Merchandise thuộc một sự kiện và do tổ chức sở hữu sự kiện quản lý.',jsonb_build_array('Merchandise thuộc một sự kiện, do tổ chức sở hữu sự kiện quản lý. Tên nghệ sĩ hoặc chương trình là nhận diện hiển thị, không thay đơn vị bán.','Organizer có thể cho mua độc lập hoặc yêu cầu có vé. Mua hàng không đồng nghĩa có quyền vào cửa.','Hãy xem kỹ biến thể, phí giao hàng và chính sách đổi trả trước khi thanh toán.'),'https://images.pexels.com/photos/20993079/pexels-photo-20993079.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','Guides',5,'PUBLISHED','2026-09-08 02:00:00'),
(910002,'first-event','Lần đầu đi sự kiện? Bắt đầu từ những điều nhỏ.','Đọc kỹ thời gian, địa điểm và hình thức vé trước khi quyết định.',jsonb_build_array('Chọn một trải nghiệm bạn thực sự muốn tham gia. Đọc thông tin thời gian, địa điểm và hình thức vé trước khi quyết định.','Vé có ghế đánh số và vé theo khu hoặc số lượng có cách chọn khác nhau.','Khi mua cho nhiều người, tên người tham dự được nhập riêng cho từng vé.','Nếu sự kiện thay đổi hoặc bị hủy, theo dõi thông báo và tình trạng xử lý đơn.'),'https://images.pexels.com/photos/12657546/pexels-photo-12657546.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','Guides',7,'PUBLISHED','2026-09-05 02:00:00'),
(910003,'check-in','Check-in trước và vào cửa: Hai bước, một cuộc hẹn.','Check-in xác nhận tham dự và chưa đồng nghĩa vé đã được sử dụng.',jsonb_build_array('Check-in online mở từ 24 giờ trước khi suất bắt đầu và đóng khi suất bắt đầu.','Đã check-in chỉ có nghĩa bạn đã xác nhận tham dự.','Nếu chưa check-in online, bạn có thể làm tại quầy theo giờ nhà tổ chức công bố.','Khi tới cửa, nhân viên kiểm tra mã vé hoặc QR bằng hệ thống.'),'https://images.pexels.com/photos/32399568/pexels-photo-32399568.jpeg?auto=compress&cs=tinysrgb&h=650&w=940','Ticketing',6,'PUBLISHED','2026-09-01 02:00:00')
ON CONFLICT DO NOTHING;

INSERT INTO event_change_requests
  (id,public_id,event_id,organization_id,requested_by,request_type,reason,impact_summary,status,visible_on_catalog,requested_at,decided_by,decided_at)
VALUES
(911001,'rr1',905003,902003,900103,'NEW_SALE_WAVE','Mở đợt bán tiếp theo trong hạn mức đã được duyệt.','Không thay đổi quyền của vé đã bán; áp dụng cho lượng vé còn lại.','APPROVED',TRUE,'2026-09-18 03:00:00',900001,'2026-09-19 03:00:00'),
(911002,'rr2',905005,902006,900106,'CAPACITY','Bổ sung sức chứa sau khi cập nhật bố trí không gian.','Sơ đồ và giới hạn sức chứa mới đã được duyệt trước khi mở bán.','APPROVED',TRUE,'2026-09-20 03:00:00',900001,'2026-09-21 03:00:00')
ON CONFLICT DO NOTHING;

-- Đồng bộ identity sau các ID fixture ghi tường minh.
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM users;
SELECT setval(pg_get_serial_sequence('external_identities', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM external_identities;
SELECT setval(pg_get_serial_sequence('organizations', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM organizations;
SELECT setval(pg_get_serial_sequence('organization_memberships', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM organization_memberships;
SELECT setval(pg_get_serial_sequence('venues', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM venues;
SELECT setval(pg_get_serial_sequence('events', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM events;
SELECT setval(pg_get_serial_sequence('seat_layouts', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM seat_layouts;
SELECT setval(pg_get_serial_sequence('event_sessions', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM event_sessions;
SELECT setval(pg_get_serial_sequence('event_reviews', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM event_reviews;
SELECT setval(pg_get_serial_sequence('merchandise_products', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM merchandise_products;
SELECT setval(pg_get_serial_sequence('blog_articles', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM blog_articles;
SELECT setval(pg_get_serial_sequence('event_change_requests', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM event_change_requests;
COMMIT;
