# แผน deploy Keyded

> สำรวจเซิร์ฟเวอร์จริงเมื่อ 5 ก.ย. 2569 · repo `https://gitlab.com/tardev-group/keyded`

## ⚠️ เครื่องนี้ไม่ใช่เครื่องเปล่า

`45.32.122.181` ชื่อ **PBN-1** เป็นเครื่องโปรดักชันที่รันอยู่แล้ว

```
Ubuntu 22.04.5 LTS · 2 cores · RAM 1.9 GB + swap 7.7 GB (ใช้ไป 109 MB)
ดิสก์ 75 GB ใช้ไป 22 GB · uptime 48 วัน · load average 0.00
nginx 1.18 เสิร์ฟอยู่ 324 เว็บ ทั้งหมด listen 80
node v22.23.2 ติดตั้งแล้ว · มีแอป node อีกตัวรันอยู่ที่พอร์ต 3000 (server.mjs)
ไม่มี PostgreSQL · ไม่มี Docker · มี certbot กับ ufw
ufw เปิด 22 · 80 · Nginx Full
```

**กฎเหล็กของงานนี้ — ห้ามแตะไฟล์ของอีก 324 เว็บ** เพิ่มไฟล์ใหม่อย่างเดียว
เว็บพวกนั้นคือรายได้ที่เดินอยู่ ถ้าเราทำ nginx ล่ม มันล่มพร้อมกันหมด

## สิ่งที่ตัดสินใจแล้วและเหตุผล

| เรื่อง | เลือก | เพราะ |
|---|---|---|
| ฐานข้อมูล | **PostgreSQL จาก apt** ไม่ใช่ Docker | RAM เหลือ 1.1 GB · Docker กินเพิ่มโดยไม่ได้อะไรตอบแทน และเครื่องนี้ยังไม่มี Docker เลย |
| พอร์ตหลังบ้าน | **4000** | ว่าง (3000 มีคนใช้แล้ว) |
| จัดการโปรเซส | **systemd** | เครื่องนี้ใช้ systemd อยู่แล้ว (`ct-live.service`) ไม่ต้องลง pm2 เพิ่ม |
| build หน้าเว็บ | **บน GitLab runner** ไม่ใช่บนเซิร์ฟเวอร์ | `vite build` กิน RAM เยอะ ถ้า build บนเครื่องจะไปแย่ง RAM ของ 324 เว็บ |
| ส่งไฟล์ | **rsync ผ่าน SSH** | ไม่ต้องลง Docker registry หรือ git บนเครื่อง |
| TLS | **ยังไม่ตั้ง** | เครื่องไม่ได้ฟังพอร์ต 443 เลยทั้งที่มี 324 เว็บ แปลว่า TLS น่าจะจบที่ Cloudflare อยู่แล้ว ต้องยืนยันก่อน |

## ยังตอบไม่ได้ ต้องรู้ก่อนเริ่ม

1. **จะใช้โดเมนอะไร** — nginx บนเครื่องนี้แยกเว็บด้วย `server_name` ทั้งหมด ถ้าไม่มีโดเมนจะเข้าด้วย IP ไม่ได้เพราะไปชนกับ default server ของเว็บอื่น
2. **Cloudflare อยู่หน้าเครื่องนี้ใช่ไหม** — ถ้าใช่ TLS จบที่นั่น เราไม่ต้องทำอะไร · ถ้าไม่ใช่ ต้องใช้ certbot ที่ติดตั้งไว้แล้วออกใบรับรอง
3. **ผู้ใช้ที่จะให้ GitLab ใช้ deploy** — ตอนนี้เครื่องมี `root` กับ `linuxuser` · **ไม่ควรให้ CI ใช้ root** ควรสร้าง `keyded` แยก

## ขั้นตอนติดตั้งครั้งแรก (ทำครั้งเดียว บนเซิร์ฟเวอร์)

```bash
# 1. ผู้ใช้เฉพาะของแอป ไม่ให้ CI แตะ root
adduser --system --group --home /opt/keyded keyded
mkdir -p /opt/keyded/backend /var/www/keyded
chown -R keyded:keyded /opt/keyded /var/www/keyded

# 2. PostgreSQL
apt update && apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER keyded WITH PASSWORD 'ตั้งรหัสยาวๆ';"
sudo -u postgres psql -c "CREATE DATABASE keyded OWNER keyded;"

# RAM น้อย ต้องหรี่ค่าเริ่มต้นของ postgres ลง ไม่งั้นไปเบียดเว็บอื่น
sudo -u postgres psql -c "ALTER SYSTEM SET shared_buffers = '128MB';"
sudo -u postgres psql -c "ALTER SYSTEM SET max_connections = '40';"
sudo -u postgres psql -c "ALTER SYSTEM SET work_mem = '4MB';"
systemctl restart postgresql

# 3. ไฟล์ลับ — สร้างบนเซิร์ฟเวอร์ ไม่เคยผ่าน git
cp /path/to/.env.example /opt/keyded/.env
nano /opt/keyded/.env      # เติม DATAFORSEO_*, DATABASE_URL, JWT_SECRET
chown keyded:keyded /opt/keyded/.env && chmod 600 /opt/keyded/.env

# 4. systemd
cp deploy/keyded-api.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now keyded-api

# 5. nginx — เพิ่มไฟล์เดียว ไม่แตะของเดิม
cp deploy/nginx-keyded.conf /etc/nginx/sites-available/keyded
sed -i 's/DOMAIN_HERE/โดเมนจริง/' /etc/nginx/sites-available/keyded
ln -s /etc/nginx/sites-available/keyded /etc/nginx/sites-enabled/keyded
nginx -t && systemctl reload nginx      # nginx -t ต้องผ่านก่อนเสมอ

# 6. ให้ผู้ใช้ keyded รีสตาร์ตตัวเองได้โดยไม่ต้องเป็น root
echo 'keyded ALL=(root) NOPASSWD: /bin/systemctl restart keyded-api' \
  > /etc/sudoers.d/keyded && chmod 440 /etc/sudoers.d/keyded

# 7. ผู้ดูแลระบบคนแรก
cd /opt/keyded/backend && sudo -u keyded node src/db/seed-admin.js you@example.com รหัสผ่าน
```

## ตั้งค่า GitLab CI

ใส่ที่ **Settings → CI/CD → Variables** (ติ๊ก Masked และ Protected)

| ตัวแปร | ค่า |
|---|---|
| `SSH_PRIVATE_KEY` | private key ที่คู่กับ public key ใน `/opt/keyded/.ssh/authorized_keys` |
| `DEPLOY_HOST` | `45.32.122.181` |
| `DEPLOY_USER` | `keyded` |
| `DEPLOY_DOMAIN` | โดเมนจริง |

**สร้าง key คู่ใหม่สำหรับ CI โดยเฉพาะ** ห้ามใช้ `/root/.ssh/id_ed25519` ที่มีอยู่แล้ว
เพราะคีย์นั้นเข้าถึงทั้งเครื่องได้ ถ้าหลุดจาก GitLab คือเสีย 324 เว็บพร้อมกัน

```bash
ssh-keygen -t ed25519 -f keyded-deploy -C "gitlab-ci keyded" -N ""
# เอา keyded-deploy.pub ไปใส่ /opt/keyded/.ssh/authorized_keys
# เอา keyded-deploy ไปใส่ตัวแปร SSH_PRIVATE_KEY ใน GitLab
```

## ลำดับการ deploy

```
push ขึ้น main
  → build-frontend   บน runner (npm ci + vite build)
  → deploy-production  กดเองด้วยมือ (when: manual)
      rsync dist  ->  /var/www/keyded/dist.new/
      rsync backend -> /opt/keyded/backend/
      release.sh:  npm ci --omit=dev
                   npm run migrate
                   สลับ dist.new -> dist ทีเดียว
                   systemctl restart keyded-api
                   รอ health check 30 วินาที
```

ตั้งเป็น **manual** ไว้ก่อนเพราะเครื่องนี้มีเว็บอื่นอยู่ ยังไม่ควรให้ deploy อัตโนมัติทุก push

## ตรวจหลัง deploy ทุกครั้ง

```bash
curl -I https://โดเมน/                     # index.html ต้องเป็น no-cache
curl -s https://โดเมน/api/health            # ต้องได้ {"ok":true}
systemctl status keyded-api --no-pager
journalctl -u keyded-api -n 30 --no-pager
free -h                                     # RAM ต้องยังเหลือให้เว็บอื่น
curl -I https://เว็บเดิมสักอัน/             # ยืนยันว่าไม่ไปทำอะไรของเดิมพัง
```

**อย่าเชื่อว่า push ขึ้นแล้วจบ** ต้องเปิดหน้าเว็บจริงแล้วเห็นของใหม่ (บทเรียนใน CLAUDE.md)

## ที่ยังไม่ได้ทำ ต้องทำก่อนเปิดให้คนนอกใช้

- **สำรองฐานข้อมูล** — `pg_dump` รายวันเก็บไว้นอกเครื่อง · ตอนนี้ยังไม่มี
- **TLS** — รอคำตอบว่า Cloudflare อยู่หน้าเครื่องไหม
- **ปิด `/auth/register`** หรือใส่โค้ดเชิญ — ตอนนี้ใครก็สมัครได้ และทุกการสมัครคือโควตาที่เสียเงินจริง
- **จำกัดขนาด log** — `search_logs` โตทุกการค้นหา ควรมีแผนตัดของเก่า
- **เฝ้ายอด DataForSEO** — ถ้าเงินหมดระบบจะพังเงียบๆ ควรแจ้งเตือนตอนต่ำกว่าเกณฑ์
