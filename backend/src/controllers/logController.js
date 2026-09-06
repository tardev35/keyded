import { query } from "../db/index.js";
import { env } from "../config/env.js";

// ราคาป้ายที่ยืนยันจากบัญชีเอง 4 ก.ย. 2569 · ใช้ประเมินเฉพาะกรณีที่ไม่มีค่า cost จริงกลับมา
const UNIT_PRICE = 0.09;

const STATUS_TH = {
  ok: "สำเร็จ",
  cached: "จากแคช",
  api_error: "ระบบต้นทางขัดข้อง",
  quota_exceeded: "โควตาหมด",
  timeout: "ต้นทางตอบช้าเกินไป",
  invalid_keyword: "คำค้นหาไม่ถูกต้อง",
  throttled: "ถูกชะลอคำขอ",
};

export async function myLogs(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    // ต้นทุนที่จ่ายให้ DataForSEO เป็นข้อมูลภายใน ผู้ใช้ทั่วไปเห็นแค่ของตัวเอง
    // ผู้ดูแลเห็นของทุกคน เพราะต้องตอบให้ได้ว่าเดือนนี้จ่ายไปเท่าไหร่และใครใช้
    const isAdmin = req.user.role === "admin";
    const scope = isAdmin ? "" : " WHERE l.user_id = $1";
    const scopeArgs = isAdmin ? [] : [req.user.id];

    const { rows } = await query(
      "SELECT l.id, l.keyword, l.location_code, l.language_code, l.status, l.credits_used," +
      " l.result_count, l.duration_ms, l.api_cost, l.created_at, u.username, u.name AS display_name" +
      " FROM search_logs l LEFT JOIN users u ON u.id = l.user_id" +
      scope +
      " ORDER BY l.created_at DESC LIMIT $" + (scopeArgs.length + 1) +
      " OFFSET $" + (scopeArgs.length + 2),
      [...scopeArgs, limit, offset]
    );

    // ยอดรวมคิดจากทุกแถวในขอบเขตที่เห็น ไม่ใช่แค่หน้าที่กำลังดู
    // ส่วน savedCount คือครั้งที่โดนแคช ซึ่งถ้าไม่มีแคชจะต้องจ่ายเพิ่มอีกครั้งละเท่าราคาป้าย
    const sums = await query(
      "SELECT count(*)::int AS n," +
      " COALESCE(sum(api_cost), 0)::float AS cost," +
      " COALESCE(sum(credits_used), 0)::int AS credits," +
      " count(*) FILTER (WHERE status = 'cached')::int AS cached," +
      " count(*) FILTER (WHERE status = 'timeout')::int AS timeouts" +
      " FROM search_logs l" + scope,
      scopeArgs
    );
    const s = sums.rows[0];

    return res.json({
      total: s.n,
      isAdmin,
      showCost: isAdmin,
      totals: {
        searches: s.n,
        credits: s.credits,
        cached: s.cached,
        timeouts: s.timeouts,
        ...(isAdmin
          ? {
              cost: s.cost,
              savedCost: s.cached * UNIT_PRICE,
              unconfirmedCost: s.timeouts * UNIT_PRICE,
              unitPrice: UNIT_PRICE,
              usdThb: env.USD_THB,
            }
          : {}),
      },
      items: rows.map((r) => ({
        id: String(r.id),
        username: r.username,
        displayName: r.display_name,
        keyword: r.keyword,
        locationCode: r.location_code,
        languageCode: r.language_code,
        status: r.status,
        statusLabel: STATUS_TH[r.status] || r.status,
        creditsUsed: r.credits_used,
        resultCount: r.result_count,
        durationMs: r.duration_ms,
        apiCost: isAdmin && r.api_cost !== null ? Number(r.api_cost) : null,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

export { STATUS_TH };
