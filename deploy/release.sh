#!/usr/bin/env bash
set -euo pipefail

# รันบนเซิร์ฟเวอร์หลัง rsync เสร็จ · เครื่องนี้มีเว็บอื่น 324 ตัว
# ทุกคำสั่งในนี้ต้องแตะเฉพาะของ keyded เท่านั้น

APP=/opt/keyded
WEB=/var/www/keyded

echo "  ติดตั้ง dependency ของหลังบ้าน"
cd "$APP/backend"
npm ci --omit=dev --no-audit --no-fund

echo "  รัน migration"
npm run migrate

# สลับโฟลเดอร์ทีเดียวจบ ผู้ใช้ไม่เห็นหน้าครึ่งๆ ระหว่างคัดลอกไฟล์
echo "  สลับไฟล์หน้าเว็บ"
if [ -d "$WEB/dist.new" ]; then
  rm -rf "$WEB/dist.old"
  [ -d "$WEB/dist" ] && mv "$WEB/dist" "$WEB/dist.old"
  mv "$WEB/dist.new" "$WEB/dist"
  rm -rf "$WEB/dist.old"
fi

echo "  รีสตาร์ตหลังบ้าน"
sudo systemctl restart keyded-api

echo "  รอให้ตอบ health check"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    echo "  ขึ้นแล้วใน ${i} วินาที"
    exit 0
  fi
  sleep 1
done

echo "  x หลังบ้านไม่ตอบภายใน 30 วินาที — ดู log ด้วย journalctl -u keyded-api -n 50"
exit 1
