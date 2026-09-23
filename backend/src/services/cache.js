import { query } from "../db/index.js";
import { env } from "../config/env.js";
import { latestMonthOf } from "./normalize.js";

export const IDEAS = "ideas";
export const LABS = "labs";
export const METRICS = "metrics";

export const cacheKey = (keyword) => String(keyword).trim().toLowerCase().replace(/\s+/g, " ");

export function makeKey({ keyword, locationCode, languageCode, kind = IDEAS }) {
  return kind + "|" + cacheKey(keyword) + "|" + locationCode + "|" + languageCode;
}

const monthValue = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return d.getUTCFullYear() * 12 + (d.getUTCMonth() + 1);
};

// อายุแคชอย่างเดียวไม่พอ — 30 วันนับจากวันที่ "เราดึง" ไม่ใช่วันที่ "Google ออกข้อมูลใหม่"
// ถ้าเผอิญดึงมาก่อน Google อัปเดตหนึ่งวัน ผู้ใช้จะเห็นข้อมูลเก่าไปอีกเกือบเดือนเต็ม
//
// จึงดูเดือนล่าสุดในเนื้อข้อมูลด้วย เทียบกับเดือนใหม่สุดที่เคยเห็นในตลาดเดียวกัน
// (location + language) · พอมีใครสักคนดึงสดแล้วเจอเดือนใหม่ ทุกแคชที่ยังค้างเดือนเก่า
// จะกลายเป็นของหมดอายุทันที และถูกดึงใหม่เมื่อมีคนเปิดครั้งถัดไป
//
// ต้องเทียบภายใน kind เดียวกันเท่านั้น — Labs กับ Google Ads คนละฐานและออกเดือนใหม่ไม่พร้อมกัน
// วัดจริง 24 ก.ย. 2569 — Google Ads ขึ้นเดือน ส.ค. ราว 11 ก.ย. ส่วน Labs ขึ้นวันที่ 16
// ห้าวันระหว่างนั้นแถว Labs ทุกแถวถูกตัดสินว่าเก่าเพราะไปเทียบกับเดือนของ Google Ads
// ยิงใหม่แล้วได้เดือนเดิมกลับมา แล้วก็ถูกตัดสินว่าเก่าอีก · อัตราแคชโดนของคำที่ค้นซ้ำ
// ร่วงจาก 100% เหลือ 31% และยิงซ้ำฟรี 107 ครั้ง ($3.58) ในหกวัน
export async function readCache({ keyword, locationCode, languageCode, kind = IDEAS }) {
  const key = cacheKey(keyword);
  const { rows } = await query(
    "SELECT c.payload, c.fetched_at, c.latest_month," +
    " (SELECT max(w.latest_month) FROM keyword_cache w" +
    "  WHERE w.location_code = c.location_code AND w.language_code = c.language_code AND w.kind = c.kind) AS watermark" +
    " FROM keyword_cache c" +
    " WHERE c.keyword = $1 AND c.location_code = $2 AND c.language_code = $3 AND c.kind = $4",
    [key, locationCode, languageCode, kind]
  );
  if (!rows.length) return null;

  const { payload, fetched_at: fetchedAt, watermark } = rows[0];
  let latestMonth = rows[0].latest_month;

  // แถวที่เขียนไว้ก่อนมี migration 002 ยังไม่มีค่านี้ · เติมจากเนื้อข้อมูลที่มีอยู่แล้ว ไม่ต้องยิง API
  if (!latestMonth) {
    const derived = latestMonthOf(payload.rows);
    if (derived) {
      await query(
        "UPDATE keyword_cache SET latest_month = $5" +
        " WHERE keyword = $1 AND location_code = $2 AND language_code = $3 AND kind = $4",
        [key, locationCode, languageCode, kind, derived]
      );
      latestMonth = derived;
    }
  }

  const ageDays = (Date.now() - new Date(fetchedAt).getTime()) / 86400000;
  if (ageDays > env.CACHE_DAYS) return { stale: "อายุเกิน " + env.CACHE_DAYS + " วัน" };

  const mine = monthValue(latestMonth);
  const newest = monthValue(watermark);
  if (mine && newest && mine < newest) {
    return { stale: "Google ออกข้อมูลเดือนใหม่แล้ว" };
  }

  return { payload, fetchedAt, ageDays: Math.floor(ageDays), latestMonth, watermark };
}

// โหมดหลายคำต้องเช็กทีเดียวทั้งชุด ไม่ใช่ไล่ยิงทีละคำ ไม่งั้นรายการยาวๆ จะเปิดคิว DB เป็นร้อยรอบ
export async function readManyCache({ keywords, locationCode, languageCode, kind = METRICS }) {
  if (!keywords.length) return new Map();
  const keys = keywords.map(cacheKey);
  const { rows } = await query(
    "SELECT c.keyword, c.payload, c.fetched_at, c.latest_month," +
    " (SELECT max(w.latest_month) FROM keyword_cache w" +
    "  WHERE w.location_code = c.location_code AND w.language_code = c.language_code AND w.kind = c.kind) AS watermark" +
    " FROM keyword_cache c" +
    " WHERE c.keyword = ANY($1) AND c.location_code = $2 AND c.language_code = $3 AND c.kind = $4",
    [keys, locationCode, languageCode, kind]
  );

  const hits = new Map();
  for (const row of rows) {
    const ageDays = (Date.now() - new Date(row.fetched_at).getTime()) / 86400000;
    if (ageDays > env.CACHE_DAYS) continue;
    const mine = monthValue(row.latest_month);
    const newest = monthValue(row.watermark);
    if (mine && newest && mine < newest) continue;
    hits.set(row.keyword, { payload: row.payload, fetchedAt: row.fetched_at, ageDays: Math.floor(ageDays) });
  }
  return hits;
}

export async function writeCache(client, { keyword, locationCode, languageCode, payload, kind = IDEAS }) {
  await client.query(
    "INSERT INTO keyword_cache (keyword, location_code, language_code, kind, payload, latest_month, fetched_at)" +
    " VALUES ($1, $2, $3, $4, $5, $6, now())" +
    " ON CONFLICT (keyword, location_code, language_code, kind)" +
    " DO UPDATE SET payload = EXCLUDED.payload, latest_month = EXCLUDED.latest_month, fetched_at = now()",
    [cacheKey(keyword), locationCode, languageCode, kind, JSON.stringify(payload), latestMonthOf(payload.rows)]
  );
}
