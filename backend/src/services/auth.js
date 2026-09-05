import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db/index.js";
import { env } from "../config/env.js";
import { nextResetAt } from "../lib/time.js";

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.code = "auth_error";
    this.status = status;
  }
}

const QUOTA_BY_ROLE = {
  admin: 0,
  paid: env.QUOTA_PAID_PER_DAY,
  free: env.QUOTA_FREE_PER_DAY,
};

const WITH_TEAM =
  "SELECT u.*, t.name AS team_name FROM users u LEFT JOIN teams t ON t.id = u.team_id";

const publicUser = (u) => ({
  id: String(u.id),
  username: u.username,
  name: u.name,
  role: u.role,
  teamId: u.team_id ? String(u.team_id) : null,
  teamName: u.team_name ?? null,
  creditsDaily: u.credits_daily,
  creditsLeft: u.credits_left,
  creditsResetAt: u.credits_reset_at,
});

export function signTokens(user) {
  const payload = { sub: String(user.id), role: user.role };
  return {
    token: jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN }),
    refreshToken: jwt.sign({ ...payload, typ: "refresh" }, env.JWT_SECRET, { expiresIn: env.REFRESH_EXPIRES_IN }),
  };
}

// ปิดการสมัครเอง — ผู้ดูแลเป็นคนตั้งบัญชีให้ทั้งหมด
// ทุกบัญชีใหม่คือโควตาที่เสียเงินจริง จะเปิดให้คนนอกสมัครเองไม่ได้
export async function register() {
  throw new AuthError("ระบบนี้ไม่เปิดให้สมัครเอง ติดต่อผู้ดูแลเพื่อขอบัญชี", 403);
}

// เข้าระบบด้วยชื่อผู้ใช้ ไม่ใช่อีเมล — บัญชีที่ผู้ดูแลสร้างให้อาจไม่มีอีเมลเลย
export async function login({ username, password }) {
  const clean = String(username || "").trim().toLowerCase();
  const { rows } = await query(WITH_TEAM + " WHERE lower(u.username) = $1", [clean]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(String(password || ""), user.password_hash));
  if (!ok) throw new AuthError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  if (user.disabled_at) throw new AuthError("บัญชีนี้ถูกระงับการใช้งาน", 403);

  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  return { user: publicUser(user), ...signTokens(user) };
}

export async function refresh(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(String(refreshToken || ""), env.JWT_SECRET);
  } catch {
    throw new AuthError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }
  if (decoded.typ !== "refresh") throw new AuthError("โทเคนไม่ถูกต้อง");
  const { rows } = await query(WITH_TEAM + " WHERE u.id = $1", [decoded.sub]);
  const user = rows[0];
  if (!user || user.disabled_at) throw new AuthError("บัญชีนี้ใช้งานไม่ได้แล้ว", 403);
  return { user: publicUser(user), ...signTokens(user) };
}

export async function currentUser(userId) {
  const { rows } = await query(WITH_TEAM + " WHERE u.id = $1", [userId]);
  if (!rows[0]) throw new AuthError("ไม่พบบัญชีผู้ใช้");
  return publicUser(rows[0]);
}

export { publicUser, QUOTA_BY_ROLE, nextResetAt };
