import { withTransaction } from "../db/index.js";
import { isNewDay, nextResetAt } from "../lib/time.js";
import { writeCache } from "./cache.js";

export class QuotaError extends Error {
  constructor(message) {
    super(message);
    this.code = "quota_exceeded";
    this.status = 429;
  }
}

// รอบวันตัดที่เที่ยงคืนไทย ไม่ใช่ UTC — เทียบด้วย credits_reset_at ที่คำนวณจาก Asia/Bangkok
// ไว้แล้ว ไม่ใช่เทียบวันที่ของ created_at (PLAN ข้อ 5)
export async function loadUserForUpdate(client, userId) {
  const { rows } = await client.query(
    "SELECT id, email, name, role, credits_daily, credits_left, credits_reset_at, disabled_at" +
    " FROM users WHERE id = $1 FOR UPDATE",
    [userId]
  );
  const user = rows[0];
  if (!user) throw new QuotaError("ไม่พบบัญชีผู้ใช้");
  if (user.disabled_at) throw new QuotaError("บัญชีนี้ถูกระงับการใช้งาน");

  if (isNewDay(user.credits_reset_at)) {
    const reset = nextResetAt();
    await client.query(
      "UPDATE users SET credits_left = credits_daily, credits_reset_at = $2 WHERE id = $1",
      [user.id, reset]
    );
    user.credits_left = user.credits_daily;
    user.credits_reset_at = reset;
  }
  return user;
}

export const isUnlimited = (user) => user.role === "admin";

export async function assertHasCredit(client, userId) {
  const user = await loadUserForUpdate(client, userId);
  if (!isUnlimited(user) && user.credits_left <= 0) {
    throw new QuotaError("โควตาการค้นหาวันนี้หมดแล้ว รอบใหม่เริ่มเที่ยงคืนตามเวลาไทย");
  }
  return user;
}

async function insertLog(client, entry) {
  const { rows } = await client.query(
    "INSERT INTO search_logs" +
    " (user_id, keyword, location_code, language_code, status, credits_used," +
    "  result_count, duration_ms, api_cost, error)" +
    " VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
    [
      entry.userId,
      entry.keyword,
      entry.locationCode,
      entry.languageCode,
      entry.status,
      entry.creditsUsed ?? 0,
      entry.resultCount ?? null,
      entry.durationMs ?? null,
      entry.apiCost ?? null,
      entry.error ?? null,
    ]
  );
  return rows[0].id;
}

// หักเครดิต เขียน log และบันทึกผลลัพธ์ ต้องจบพร้อมกันหรือไม่เกิดเลย
// หักตาม "การค้นหา" ครั้งละ 1 ไม่ใช่ตามจำนวนคำที่ได้กลับมา (PLAN ข้อ 2.4)
export async function commitPaidSearch({ userId, keyword, locationCode, languageCode, payload, meta, charge = true }) {
  return withTransaction(async (client) => {
    const user = await loadUserForUpdate(client, userId);
    let creditsUsed = 0;
    let creditsLeft = user.credits_left;

    if (charge && !isUnlimited(user)) {
      const { rows } = await client.query(
        "UPDATE users SET credits_left = credits_left - 1" +
        " WHERE id = $1 AND credits_left > 0 RETURNING credits_left",
        [userId]
      );
      if (!rows.length) {
        await insertLog(client, {
          userId, keyword, locationCode, languageCode,
          status: "quota_exceeded", creditsUsed: 0,
          resultCount: meta.resultCount, durationMs: meta.durationMs, apiCost: meta.apiCost,
          error: "ยิง API สำเร็จแล้วแต่เครดิตไม่พอตอนหัก",
        });
        throw new QuotaError("โควตาการค้นหาวันนี้หมดแล้ว รอบใหม่เริ่มเที่ยงคืนตามเวลาไทย");
      }
      creditsUsed = 1;
      creditsLeft = rows[0].credits_left;
    }

    await writeCache(client, { keyword, locationCode, languageCode, payload });

    const logId = await insertLog(client, {
      userId, keyword, locationCode, languageCode,
      status: "ok", creditsUsed,
      resultCount: meta.resultCount, durationMs: meta.durationMs, apiCost: meta.apiCost,
    });

    return { creditsLeft, creditsUsed, logId, unlimited: isUnlimited(user) };
  });
}

// โหมดหลายคำหักครั้งละ 1 เท่ากับโหมดคำเดียว ตามข้อ 2.4 — หักตาม "การค้นหา" ไม่ใช่ตามจำนวนคำ
// (ตัดสินใจ 5 ก.ย. 2569) · ตัวคุมต้นทุนจึงเป็นเพดานจำนวนคำต่อครั้ง ไม่ใช่จำนวนเครดิต
// ถ้าวันหนึ่งค่า API ต่อเครดิตสูงเกินรับไหว ให้ลด KEYFIN_BULK_MAX ไม่ใช่กลับมาหักหลายเครดิต
export async function commitBulkSearch({ userId, keyword, locationCode, languageCode, entries, charge, meta }) {
  return withTransaction(async (client) => {
    const user = await loadUserForUpdate(client, userId);
    let creditsUsed = 0;
    let creditsLeft = user.credits_left;

    if (charge > 0 && !isUnlimited(user)) {
      const { rows } = await client.query(
        "UPDATE users SET credits_left = credits_left - $2" +
        " WHERE id = $1 AND credits_left >= $2 RETURNING credits_left",
        [userId, charge]
      );
      if (!rows.length) {
        await insertLog(client, {
          userId, keyword, locationCode, languageCode,
          status: "quota_exceeded", creditsUsed: 0,
          resultCount: meta.resultCount, durationMs: meta.durationMs, apiCost: meta.apiCost,
          error: "ยิง API สำเร็จแล้วแต่เครดิตไม่พอตอนหัก (ต้องใช้ " + charge + ")",
        });
        throw new QuotaError("โควตาไม่พอสำหรับรายการนี้ ต้องใช้ " + charge + " ครั้ง เหลือ " + user.credits_left);
      }
      creditsUsed = charge;
      creditsLeft = rows[0].credits_left;
    }

    for (const entry of entries) await writeCache(client, entry);

    const logId = await insertLog(client, {
      userId, keyword, locationCode, languageCode,
      status: charge > 0 ? "ok" : "cached", creditsUsed,
      resultCount: meta.resultCount, durationMs: meta.durationMs, apiCost: meta.apiCost,
    });

    return { creditsLeft, creditsUsed, logId, unlimited: isUnlimited(user) };
  });
}

// โดนแคชไม่ได้จ่ายเงินให้ DataForSEO จึงไม่หักเครดิต แต่ยังต้องมี log
// ไม่งั้นเราจะตอบไม่ได้ว่าอัตราโดนแคชจริงเท่าไหร่ (PLAN ข้อ 5)
export async function commitCachedSearch({ userId, keyword, locationCode, languageCode, meta }) {
  return withTransaction(async (client) => {
    const user = await loadUserForUpdate(client, userId);
    const logId = await insertLog(client, {
      userId, keyword, locationCode, languageCode,
      status: "cached", creditsUsed: 0,
      resultCount: meta.resultCount, durationMs: meta.durationMs, apiCost: 0,
    });
    return { creditsLeft: user.credits_left, creditsUsed: 0, logId, unlimited: isUnlimited(user) };
  });
}

export async function commitFailedSearch({ userId, keyword, locationCode, languageCode, status, meta, error }) {
  return withTransaction(async (client) => {
    const user = await loadUserForUpdate(client, userId);
    const logId = await insertLog(client, {
      userId, keyword, locationCode, languageCode,
      status, creditsUsed: 0,
      resultCount: meta?.resultCount ?? null,
      durationMs: meta?.durationMs ?? null,
      apiCost: meta?.apiCost ?? null,
      error,
    });
    return { creditsLeft: user.credits_left, logId };
  });
}
