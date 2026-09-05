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
| TLS | **Cloudflare ไม่ใช้ certbot** | ยืนยันแล้ว 5 ก.ย. 2569 · `keyded.yoalink.com` ชี้ไป 104.21.38.65 / 172.67.219.183 ซึ่งเป็น IP ของ Cloudflare · เครื่องฟังแค่พอร์ต 80 เหมือนอีก 324 เว็บ |

## โดเมนและ Cloudflare

**`keyded.yoalink.com`** · ตรวจ DNS แล้วชี้ไป Cloudflare เรียบร้อย (104.21.38.65 · 172.67.219.183)

**ที่ต้องตั้งใน Cloudflare**

| หัวข้อ | ค่า | เพราะ |
|---|---|---|
| A record | `45.32.122.181` เมฆสีส้ม (Proxied) | ต้องยืนยันว่าชี้มาเครื่องนี้จริง |
| SSL/TLS mode | **Flexible** | เครื่องปลายทางไม่ได้ฟัง 443 เลยทั้ง 324 เว็บ ถ้าตั้ง Full จะได้ 521 ทันที |
| Cache | ปล่อยค่าเริ่มต้น | origin ส่ง `no-cache` ให้ `index.html` และ `no-store` ให้ `/api/` อยู่แล้ว |

**ข้อควรรู้สองอย่าง**

- **Flexible แปลว่าช่วง Cloudflare → เครื่องเราเป็น HTTP ธรรมดา** ไม่เข้ารหัส · เว็บอีก 324 ตัวก็เป็นแบบนี้อยู่แล้ว แต่แอปนี้มีรหัสผ่านผู้ใช้กับ JWT วิ่งผ่าน ถ้าวันหนึ่งอยากรัดกุมกว่านี้ ทางที่ถูกคือเปิด 443 ด้วย Cloudflare Origin Certificate (ฟรี อายุ 15 ปี ไม่ต้องต่ออายุแบบ certbot) แล้วเปลี่ยนเป็น Full (strict)
- **Cloudflare แผนฟรี/Pro ตัดคำขอที่ 100 วินาที** ค้นคำกว้างวัดได้สูงสุด 43 วินาที ยังไม่ชน แต่ถ้าวันหนึ่งช้ากว่านั้นผู้ใช้จะเจอ error 524 ของ Cloudflare ไม่ใช่ของเรา

**nginx แปลง IP กลับให้แล้ว** — ถ้าไม่ทำ `$remote_addr` จะเป็น IP ของ Cloudflare ทุกคน
แล้วระบบจำกัดคำขอรายไอพี (CLAUDE.md เรื่องความปลอดภัย) จะมองคนทั้งโลกเป็นคนเดียว
ช่วง IP ในไฟล์ config ดึงจาก `cloudflare.com/ips-v4` เมื่อ 5 ก.ย. 2569 · **Cloudflare เพิ่มช่วงใหม่เป็นระยะ ควรอัปเดตปีละครั้ง**

## ยังตอบไม่ได้ ต้องรู้ก่อนเริ่ม

1. **ผู้ใช้ที่จะให้ GitLab ใช้ deploy** — ตอนนี้เครื่องมี `root` กับ `linuxuser` · **ไม่ควรให้ CI ใช้ root** ควรสร้าง `keyded` แยก
2. **ยืนยันว่า A record ของ `keyded.yoalink.com` ชี้มาที่ 45.32.122.181** — ตอนนี้เห็นแค่ว่าผ่าน Cloudflare แต่มองไม่เห็นว่าปลายทางเป็นเครื่องไหน

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
| `DEPLOY_DOMAIN` | `keyded.yoalink.com` |

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
curl -I https://keyded.yoalink.com/          # index.html ต้องเป็น no-cache
curl -s https://keyded.yoalink.com/api/health # ต้องได้ {"ok":true}
systemctl status keyded-api --no-pager
journalctl -u keyded-api -n 30 --no-pager
free -h                                     # RAM ต้องยังเหลือให้เว็บอื่น
curl -I https://เว็บเดิมสักอัน/             # ยืนยันว่าไม่ไปทำอะไรของเดิมพัง
```

**อย่าเชื่อว่า push ขึ้นแล้วจบ** ต้องเปิดหน้าเว็บจริงแล้วเห็นของใหม่ (บทเรียนใน CLAUDE.md)

## ที่ยังไม่ได้ทำ ต้องทำก่อนเปิดให้คนนอกใช้

- **สำรองฐานข้อมูล** — `pg_dump` รายวันเก็บไว้นอกเครื่อง · ตอนนี้ยังไม่มี
- **ปิดทางเข้าตรงที่ IP** — ตอนนี้ใครรู้ IP เครื่องก็ยิงตรงข้าม Cloudflare ได้ ถ้าจะรัดกุมให้เพิ่ม `allow` เฉพาะช่วง IP ของ Cloudflare ใน server block ของเรา (อีก 324 เว็บไม่ได้ทำ จึงยังไม่ทำให้เป็นค่าเริ่มต้น)
- **ปิด `/auth/register`** หรือใส่โค้ดเชิญ — ตอนนี้ใครก็สมัครได้ และทุกการสมัครคือโควตาที่เสียเงินจริง
- **จำกัดขนาด log** — `search_logs` โตทุกการค้นหา ควรมีแผนตัดของเก่า
- **เฝ้ายอด DataForSEO** — ถ้าเงินหมดระบบจะพังเงียบๆ ควรแจ้งเตือนตอนต่ำกว่าเกณฑ์
