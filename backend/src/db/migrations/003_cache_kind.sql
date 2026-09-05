-- โหมดค้นหลายคำเก็บ "ตัวเลขของคำนั้นคำเดียว" ส่วนโหมดเดิมเก็บ "คำที่แตกออกมาทั้งชุด"
-- คนละเนื้อหาแต่คีย์เดียวกัน ถ้าไม่แยก kind สองโหมดจะเขียนทับกันเงียบๆ
ALTER TABLE keyword_cache ADD COLUMN kind TEXT NOT NULL DEFAULT 'ideas';

ALTER TABLE keyword_cache DROP CONSTRAINT keyword_cache_keyword_location_code_language_code_key;

ALTER TABLE keyword_cache
  ADD CONSTRAINT keyword_cache_key_unique UNIQUE (keyword, location_code, language_code, kind);
