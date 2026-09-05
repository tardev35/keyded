import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { query } from "../db/index.js";

export async function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" });

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
  }
  if (decoded.typ === "refresh") return res.status(401).json({ error: "โทเคนไม่ถูกต้อง" });

  const { rows } = await query(
    "SELECT id, email, name, role, credits_daily, credits_left, disabled_at FROM users WHERE id = $1",
    [decoded.sub]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "ไม่พบบัญชีผู้ใช้" });
  if (user.disabled_at) return res.status(403).json({ error: "บัญชีนี้ถูกระงับการใช้งาน" });

  req.user = user;
  return next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" });
  return next();
}
