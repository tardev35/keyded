import pg from "pg";
import { env } from "../config/env.js";

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

pool.on("error", (err) => {
  console.error("[db] pool error:", err.message);
});

export const query = (text, params) => pool.query(text, params);

// การหักเครดิต การเขียน log และการบันทึกผลลัพธ์ ต้องจบพร้อมกันหรือไม่เกิดเลย
// ไม่งั้นจะเจอสถานะหักเงินแล้วแต่ไม่มีผลให้ดู (PLAN ข้อ 2.4)
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
