-- TÙY CHỌN: địa điểm giả để thử catalog/editor; không phải giới hạn địa điểm thật.
-- Không chứa user, event bán vé, giá hay currency mặc định.
SET NAMES utf8mb4;
INSERT INTO venues (catalog_code,name,address,city,timezone,canvas_width,canvas_height,bounds_json,max_capacity)
VALUES ('DEMO-HALL-001','Hội trường minh họa (dữ liệu giả)','Địa chỉ minh họa','Demo','Asia/Ho_Chi_Minh',100,60,
        JSON_OBJECT('type','rectangle','x',0,'y',0,'width',100,'height',60),200)
ON DUPLICATE KEY UPDATE catalog_code=venues.catalog_code;
