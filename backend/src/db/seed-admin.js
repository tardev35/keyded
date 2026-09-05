import bcrypt from "bcryptjs";
import { pool } from "./index.js";
import { nextResetAt } from "../lib/time.js";

const username = String(process.argv[2] || "").trim().toLowerCase();
const password = String(process.argv[3] || "");

if (!username || password.length < 8) {
  console.error("");
  console.error("  ใช้: node src/db/seed-admin.js <username> <password ยาวอย่างน้อย 8 ตัว>");
  console.error("");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const { rows } = await pool.query(
  "INSERT INTO users (username, password_hash, name, role, credits_daily, credits_left, credits_reset_at)" +
  " VALUES ($1,$2,'ผู้ดูแลระบบ','admin',0,0,$3)" +
  " ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'" +
  " RETURNING id, username, role",
  [username, hash, nextResetAt()]
);

console.log("  ผู้ดูแลระบบพร้อมใช้งาน: " + rows[0].username);
await pool.end();
