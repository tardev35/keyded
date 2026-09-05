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

const publicUser = (u) => ({
  id: String(u.id),
  email: u.email,
  name: u.name,
  role: u.role,
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

export async function register({ email, password, name }) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) throw new AuthError("อีเมลไม่ถูกต้อง", 400);
  if (String(password || "").length < 8) throw new AuthError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร", 400);

  const exists = await query("SELECT 1 FROM users WHERE email = $1", [clean]);
  if (exists.rowCount) throw new AuthError("อีเมลนี้ถูกใช้สมัครไปแล้ว", 409);

  const hash = await bcrypt.hash(password, 10);
  const quota = QUOTA_BY_ROLE.free;
  const { rows } = await query(
    "INSERT INTO users (email, password_hash, name, role, credits_daily, credits_left, credits_reset_at)" +
    " VALUES ($1,$2,$3,'free',$4,$4,$5) RETURNING *",
    [clean, hash, String(name || "").trim() || null, quota, nextResetAt()]
  );
  const user = rows[0];
  return { user: publicUser(user), ...signTokens(user) };
}

export async function login({ email, password }) {
  const clean = String(email || "").trim().toLowerCase();
  const { rows } = await query("SELECT * FROM users WHERE email = $1", [clean]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(String(password || ""), user.password_hash));
  if (!ok) throw new AuthError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
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
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [decoded.sub]);
  const user = rows[0];
  if (!user || user.disabled_at) throw new AuthError("บัญชีนี้ใช้งานไม่ได้แล้ว", 403);
  return { user: publicUser(user), ...signTokens(user) };
}

export async function currentUser(userId) {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [userId]);
  if (!rows[0]) throw new AuthError("ไม่พบบัญชีผู้ใช้");
  return publicUser(rows[0]);
}

export { publicUser, QUOTA_BY_ROLE };
