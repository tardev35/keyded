# Keyfin — วิธีรันเครื่องตัวเอง

สเปกเต็มอยู่ที่ [PLAN.md](PLAN.md) · กฎที่พลาดง่ายอยู่ที่ [CLAUDE.md](CLAUDE.md)

## รันครั้งแรก (ทำครั้งเดียว)

```powershell
# 1. ฐานข้อมูล — ต้องเปิด Docker Desktop ให้ engine ทำงานก่อน
docker run -d --name keyfin-pg `
  -e POSTGRES_USER=keyfin -e POSTGRES_PASSWORD=keyfin_local -e POSTGRES_DB=keyfin `
  -p 5432:5432 -v keyfin-pgdata:/var/lib/postgresql/data postgres:16-alpine

# 2. หลังบ้าน
cd C:\keyfin\backend
npm install
npm run migrate
node src/db/seed-admin.js admin@keyfin.local รหัสผ่านอย่างน้อย8ตัว

# 3. หน้าเว็บ
cd C:\keyfin\frontend
npm install
```

## รันทุกวัน (เปิดสองหน้าต่าง)

```powershell
# หน้าต่างที่ 1 — หลังบ้าน  http://localhost:4000
cd C:\keyfin\backend
npm run dev

# หน้าต่างที่ 2 — หน้าเว็บ  http://localhost:5173
cd C:\keyfin\frontend
npm run dev
```

ถ้า Docker เพิ่งรีสตาร์ตให้สั่ง `docker start keyfin-pg` ก่อน

`npm run dev` ของหลังบ้านใช้ `node --watch` แก้ไฟล์แล้วรีสตาร์ตเอง
**ยกเว้น `tailwind.config.js` · `vite.config.js` · `postcss.config.js` ที่ต้องปิดแล้วเปิดใหม่**

## เช็กว่าขึ้นครบไหม

```powershell
docker ps --filter name=keyfin-pg
curl http://localhost:4000/api/health
curl http://localhost:5173
```

ตอนบูตหลังบ้านจะเช็กสองอย่างแล้วหยุดทันทีถ้าไม่ผ่าน — ต่อฐานข้อมูลได้ไหม
และรหัส DataForSEO ใช้ได้ไหม (เช็กด้วย `/appendix/user_data` ซึ่งราคา $0)

## หยุด

```powershell
# ปิด npm run dev ด้วย Ctrl+C ในแต่ละหน้าต่าง
docker stop keyfin-pg          # ข้อมูลยังอยู่
docker rm -f keyfin-pg         # ลบ container แต่ข้อมูลยังอยู่ใน volume
docker volume rm keyfin-pgdata # ลบข้อมูลทิ้งถาวร
```

## เครื่องมือวัด — ทุกคำขอคือเงินจริง

```powershell
cd C:\keyfin

# DataForSEO
node tools/measure.mjs --account     # ฟรี  ยอดเงิน ราคา และเพดานต่อนาที
node tools/measure.mjs --dry         # ฟรี  ดูว่าจะยิงอะไรบ้าง
node tools/measure.mjs               # $0.27  ราคา จำนวนคำ null และเวลาตอบ
node tools/measure.mjs --dates       # $0.18  ทดสอบ date_from 24 เดือน
node tools/measure.mjs --labs        # ~$0.03 ทดสอบ Labs keyword_suggestions
node tools/measure.mjs --burst=15    # $1.35  ทดสอบเพดานพร้อมกัน

# KeywordTool.io (ต้องใส่ KEYWORDTOOL_APIKEY ใน .env ก่อน)
node tools/measure-kwtool.mjs --quota    # ฟรี ไม่กินโควตา
node tools/measure-kwtool.mjs --sandbox  # ฟรี ไม่กินโควตา
node tools/measure-kwtool.mjs            # 3 คำขอจากโควตา 100/วัน
```

สคริปต์พิมพ์ราคาก่อนยิงเสมอ · response ดิบเก็บที่ `measurements/` ซึ่งอยู่ใน `.gitignore`

## บัญชีทดสอบ

| บทบาท | อีเมล | เห็นอะไร |
|---|---|---|
| ผู้ดูแล | `admin@keyfin.local` | ค้นไม่จำกัด · หน้าผู้ดูแล · เห็นค่า API |
| สมาชิก | สร้างจากหน้าผู้ดูแล | โควตาต่อวัน · ไม่เห็นค่า API |

## สิ่งที่ต้องรู้ก่อนแก้โค้ด

- `backend/src/services/dataforseo.js` เป็นไฟล์เดียวที่รู้จัก URL และรหัสผ่าน
- `.env` อยู่ที่รากโปรเจกต์ ใช้ร่วมกันทั้ง backend และสคริปต์ใน `tools/`
- migration ต่อท้ายอย่างเดียว ห้ามแก้ไฟล์เก่า
- `null` ไม่ใช่ `0` — อ่าน [CLAUDE.md](CLAUDE.md) กฎข้อ 1 ก่อนแตะ `normalize.js`
- **ค่าที่คำนวณจาก `months` ต้องคิดตอนอ่าน ไม่ใช่ตอนเขียนลงแคช** ไม่งั้นเปลี่ยนสูตรแล้ว
  ของเก่าในแคชจะยังถือเลขสูตรเดิม (`withFreshTrend` กับ `summarize` ทำหน้าที่นี้)

## ตอนจะขึ้นจริง

`index.html` ต้องเป็น `no-cache` ที่ origin ไม่งั้น Cloudflare จะแคชไว้หลายชั่วโมง
แล้วผู้ใช้จะยังเห็นของเก่าทั้งที่ deploy ไปแล้ว (ไฟล์ `.js` / `.css` ติด hash อยู่แล้วไม่มีปัญหา)
