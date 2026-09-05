-- เปลี่ยนการเข้าระบบจากอีเมลเป็นชื่อผู้ใช้ และเพิ่มการแบ่งทีม
-- ผู้ดูแลเป็นคนตั้งบัญชีให้โดยตรง ไม่เปิดหน้าสมัครให้คนนอก

CREATE TABLE teams (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO teams (name) VALUES ('ทีม 1'), ('ทีม 2'), ('ทีม 3');

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL;

-- บัญชีเดิมล็อกอินด้วยอีเมล ต้องมีชื่อผู้ใช้ก่อนบังคับ NOT NULL
-- ใช้ส่วนหน้า @ เป็นค่าตั้งต้น ถ้าชนกันให้ต่อท้ายด้วย id ซึ่งไม่มีวันซ้ำ
UPDATE users SET username = split_part(email, '@', 1);
UPDATE users u SET username = u.username || '-' || u.id
  WHERE EXISTS (SELECT 1 FROM users o WHERE o.username = u.username AND o.id < u.id);

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);

-- อีเมลไม่บังคับอีกต่อไป บัญชีที่ผู้ดูแลสร้างให้อาจไม่มีอีเมลเลย
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

CREATE INDEX users_team_idx ON users (team_id);
