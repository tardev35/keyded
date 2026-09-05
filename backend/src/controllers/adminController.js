import bcrypt from "bcryptjs";
import { query } from "../db/index.js";
import { STATUS_TH } from "./logController.js";
import { fetchAccount } from "../services/dataforseo.js";
import { nextResetAt } from "../lib/time.js";
import { QUOTA_BY_ROLE } from "../services/auth.js";

export async function listUsers(req, res, next) {
  try {
    const { rows } = await query(
      "SELECT u.id, u.username, u.name, u.role, u.credits_daily, u.credits_left," +
      " u.created_at, u.last_login_at, u.disabled_at, u.team_id, t.name AS team_name" +
      " FROM users u LEFT JOIN teams t ON t.id = u.team_id" +
      " ORDER BY u.created_at DESC LIMIT 500"
    );
    return res.json({
      items: rows.map((u) => ({
        id: String(u.id),
        username: u.username,
        name: u.name,
        teamId: u.team_id ? String(u.team_id) : null,
        teamName: u.team_name,
        role: u.role,
        creditsDaily: u.credits_daily,
        creditsLeft: u.credits_left,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
        disabled: Boolean(u.disabled_at),
      })),
    });
  } catch (err) {
    return next(err);
  }
}

const ROLES = ["admin", "free", "paid"];

// ชื่อผู้ใช้ต้องไม่มีช่องว่างและอักขระพิเศษ เพราะเป็นสิ่งที่คนต้องพิมพ์เข้าระบบทุกวัน
// เก็บเป็นตัวพิมพ์เล็กเสมอ ไม่งั้น somchai กับ Somchai จะกลายเป็นคนละบัญชี
const USERNAME_OK = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export async function listTeams(req, res, next) {
  try {
    const { rows } = await query("SELECT id, name FROM teams ORDER BY name");
    return res.json({ items: rows.map((t) => ({ id: String(t.id), name: t.name })) });
  } catch (err) {
    return next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = req.body?.role || "free";
    const name = String(req.body?.name || "").trim() || null;
    const teamId = req.body?.teamId ? Number(req.body.teamId) : null;

    if (!USERNAME_OK.test(username)) {
      return res.status(400).json({ error: "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–32 ตัว และขึ้นต้นด้วยตัวอักษรหรือตัวเลข" });
    }
    if (password.length < 8) return res.status(400).json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" });
    if (!ROLES.includes(role)) return res.status(400).json({ error: "สิทธิ์ไม่ถูกต้อง" });

    const exists = await query("SELECT 1 FROM users WHERE lower(username) = $1", [username]);
    if (exists.rowCount) return res.status(409).json({ error: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" });

    if (teamId) {
      const team = await query("SELECT 1 FROM teams WHERE id = $1", [teamId]);
      if (!team.rowCount) return res.status(400).json({ error: "ไม่พบทีมที่เลือก" });
    }

    // โควตาเริ่มต้นมาจากสิทธิ์ ไม่ต้องให้ผู้ดูแลกรอกตอนสร้าง แก้ทีหลังในตารางได้
    const quota = QUOTA_BY_ROLE[role] ?? 0;
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      "INSERT INTO users (username, password_hash, name, role, team_id, credits_daily, credits_left, credits_reset_at)" +
      " VALUES ($1,$2,$3,$4,$5,$6,$6,$7) RETURNING id, username, name, role, credits_daily",
      [username, hash, name, role, teamId, quota, nextResetAt()]
    );
    return res.status(201).json({ user: { ...rows[0], id: String(rows[0].id) } });
  } catch (err) {
    return next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const { role, creditsDaily, creditsLeft, disabled, name, password, resetToday, teamId } = req.body || {};
    if (role && !ROLES.includes(role)) return res.status(400).json({ error: "ระดับสมาชิกไม่ถูกต้อง" });
    if (String(req.params.id) === String(req.user.id) && role && role !== "admin") {
      return res.status(400).json({ error: "ลดสิทธิ์ของตัวเองไม่ได้ ให้ผู้ดูแลอีกคนทำแทน" });
    }
    if (password !== undefined && String(password).length < 8) {
      return res.status(400).json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" });
    }

    const hash = password === undefined ? null : await bcrypt.hash(String(password), 10);

    // credits_left ตามหลัง credits_daily เฉพาะตอนสั่งรีเซ็ตหรือแก้โควตา
    // ไม่งั้นการแก้ชื่อเฉยๆ จะไปคืนเครดิตที่ใช้ไปแล้วของวันนี้ให้ฟรี
    const { rows } = await query(
      "UPDATE users SET" +
      " role = COALESCE($2, role)," +
      " name = COALESCE($3, name)," +
      " password_hash = COALESCE($4, password_hash)," +
      " credits_daily = COALESCE($5::int, credits_daily)," +
      " credits_left = CASE" +
      "   WHEN $6::int IS NOT NULL THEN $6::int" +
      "   WHEN $7::boolean THEN COALESCE($5::int, credits_daily)" +
      "   WHEN $5::int IS NOT NULL THEN LEAST(credits_left, $5::int)" +
      "   ELSE credits_left END," +
      " disabled_at = CASE WHEN $8::boolean IS NULL THEN disabled_at" +
      "                    WHEN $8::boolean THEN now() ELSE NULL END," +
      " team_id = COALESCE($9::bigint, team_id)" +
      " WHERE id = $1" +
      " RETURNING id, username, name, role, team_id, credits_daily, credits_left, disabled_at",
      [
        req.params.id,
        role ?? null,
        name ?? null,
        hash,
        creditsDaily ?? null,
        creditsLeft ?? null,
        resetToday ?? null,
        disabled ?? null,
        teamId ?? null,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: "ไม่พบบัญชีผู้ใช้" });
    return res.json({ user: rows[0] });
  } catch (err) {
    return next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ error: "ลบบัญชีตัวเองไม่ได้" });
    }
    const { rows } = await query("DELETE FROM users WHERE id = $1 RETURNING username", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "ไม่พบบัญชีผู้ใช้" });
    return res.json({ deleted: rows[0].username });
  } catch (err) {
    return next(err);
  }
}

// ตัวเลขชุดนี้คือสิ่งที่ต้องดูก่อนตั้งราคาขาย — อัตราโดนแคชคือตัวคูณกำไรโดยตรง
// (PLAN ข้อ 2.3 และ 5)
export async function stats(req, res, next) {
  try {
    const byStatus = await query(
      "SELECT status, count(*)::int AS n, COALESCE(sum(api_cost), 0)::float AS cost" +
      " FROM search_logs WHERE created_at > now() - interval '30 days' GROUP BY status"
    );
    const daily = await query(
      "SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Bangkok')::date AS day," +
      " count(*)::int AS searches," +
      " count(*) FILTER (WHERE status = 'cached')::int AS cached," +
      " COALESCE(sum(api_cost), 0)::float AS cost" +
      " FROM search_logs WHERE created_at > now() - interval '30 days'" +
      " GROUP BY day ORDER BY day DESC"
    );
    const heavy = await query(
      "SELECT u.username, count(*)::int AS searches, COALESCE(sum(l.api_cost), 0)::float AS cost" +
      " FROM search_logs l JOIN users u ON u.id = l.user_id" +
      " WHERE l.created_at > now() - interval '30 days'" +
      " GROUP BY u.username ORDER BY cost DESC LIMIT 20"
    );
    const cacheRows = await query("SELECT count(*)::int AS n FROM keyword_cache");

    const totals = byStatus.rows.reduce((a, r) => a + r.n, 0);
    const cachedCount = byStatus.rows.find((r) => r.status === "cached")?.n ?? 0;

    // คำขอที่ timeout ฝั่งเรา DataForSEO คิดเงินไปแล้ว (วัดจริง 4 ก.ย. 2569 เสียฟรี $0.27)
    // แต่เราไม่เคยได้ response จึงไม่รู้ค่า cost · ยอดใน byStatus จึงต่ำกว่าความจริงเสมอ
    // แสดงแยกเป็น "อาจถูกคิดเงินแล้ว" ไม่เอาไปรวมกับยอดที่ยืนยันได้
    const timeoutCount = byStatus.rows.find((r) => r.status === "timeout")?.n ?? 0;

    let account = null;
    try {
      account = await fetchAccount();
    } catch {
      account = null;
    }

    return res.json({
      windowDays: 30,
      totalSearches: totals,
      cacheHitRate: totals ? Math.round((cachedCount / totals) * 100) : null,
      cachedKeywords: cacheRows.rows[0].n,
      spend: byStatus.rows.reduce((a, r) => a + r.cost, 0),
      unconfirmed: { timeouts: timeoutCount, estimatedCost: timeoutCount * 0.09 },
      byStatus: byStatus.rows.map((r) => ({
        status: r.status,
        label: STATUS_TH[r.status] || r.status,
        count: r.n,
        cost: r.cost,
      })),
      daily: daily.rows,
      heavyUsers: heavy.rows,
      account: account && account.ok ? { balance: account.balance } : null,
    });
  } catch (err) {
    return next(err);
  }
}

export async function allLogs(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { rows } = await query(
      "SELECT l.id, u.email, l.keyword, l.status, l.credits_used, l.result_count," +
      " l.duration_ms, l.api_cost, l.error, l.created_at" +
      " FROM search_logs l LEFT JOIN users u ON u.id = l.user_id" +
      " ORDER BY l.created_at DESC LIMIT $1",
      [limit]
    );
    return res.json({ items: rows.map((r) => ({ ...r, id: String(r.id) })) });
  } catch (err) {
    return next(err);
  }
}
