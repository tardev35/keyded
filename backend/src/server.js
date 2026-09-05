import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { pool } from "./db/index.js";
import { fetchAccount } from "./services/dataforseo.js";

// ตรวจให้ครบตั้งแต่ตอนบูตแล้วหยุดทันทีถ้าขาด ดีกว่าไปพังตอนผู้ใช้กดค้นหา (PLAN ข้อ 7)
async function boot() {
  try {
    await pool.query("SELECT 1");
    console.log("  db          เชื่อมต่อได้");
  } catch (err) {
    console.error("  x เชื่อมต่อฐานข้อมูลไม่ได้: " + err.message);
    console.error("    ตรวจ DATABASE_URL ใน .env แล้วรัน npm run migrate");
    process.exit(1);
  }

  // คำขอนี้ราคา $0 (วัดจริง 4 ก.ย. 2569) เช็กรหัสผ่านได้โดยไม่มีต้นทุน
  try {
    const account = await fetchAccount();
    if (!account.ok) throw new Error("ตอบกลับไม่ใช่สถานะสำเร็จ");
    console.log("  dataforseo  ใช้งานได้ · ยอดคงเหลือ $" + Number(account.balance ?? 0).toFixed(2));
  } catch (err) {
    console.error("  x ต่อ DataForSEO ไม่ได้: " + (err.userMessage || err.message));
    console.error("    ตรวจ DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD ใน .env");
    process.exit(1);
  }

  createApp().listen(env.PORT, () => {
    console.log("  keyded api  http://localhost:" + env.PORT);
    console.log("  โควตา       free " + env.QUOTA_FREE_PER_DAY + "/วัน · paid " + env.QUOTA_PAID_PER_DAY + "/วัน");
    console.log("  แคช         " + env.CACHE_DAYS + " วัน · กราฟ " + env.MONTHS_BACK + " เดือน");
    console.log("");
  });
}

boot();
