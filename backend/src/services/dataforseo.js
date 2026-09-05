import { env } from "../config/env.js";
import { dateFromForMonths } from "../lib/time.js";

const BASE = env.DATAFORSEO_BASE_URL.replace(/\/$/, "");
const AUTH = "Basic " + Buffer.from(env.DATAFORSEO_LOGIN + ":" + env.DATAFORSEO_PASSWORD).toString("base64");

const IDEAS = "/keywords_data/google_ads/keywords_for_keywords/live";
const VOLUME = "/keywords_data/google_ads/search_volume/live";
const SUGGESTIONS = "/dataforseo_labs/google/keyword_suggestions/live";
const ACCOUNT = "/appendix/user_data";

// วัดจริง 4 ก.ย. 2569 — ตัดที่ 40 วินาทีแล้วเสียเงินฟรีสองครั้ง ($0.18) เพราะ DataForSEO
// คิดเงินไปแล้วตั้งแต่เริ่มประมวลผล การยกเลิกฝั่งเราจึงไม่ได้ประหยัดอะไรเลย มีแต่ทิ้งของที่จ่ายไปแล้ว
// ตั้งยาวไว้ก่อน แล้วไปบอกผู้ใช้ว่ารออยู่แทนการตัดทิ้ง (PLAN ข้อ 6)
const TIMEOUT_MS = 150000;

export class DataForSeoError extends Error {
  constructor({ code, userMessage, detail, status }) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
    this.detail = detail;
    this.status = status || 502;
  }
}

// วัดจริง 4 ก.ย. 2569 — คำที่มีวงเล็บทำให้ทั้งคำขอตกด้วย task 40501 ไม่ใช่แค่คำนั้นหาย
// ตัวอื่นในลิสต์นี้มาจากเอกสาร Google Ads ยังไม่ได้ยิงยืนยันทีละตัว
const INVALID_CHARS = /[()[\]{}<>!@%^*~;,"|\\]/;
const MAX_LENGTH = 80;

// สระบนล่างกับวรรณยุกต์ขึ้นต้นคำไทยไม่ได้ · เจอแบบนี้แปลว่าพิมพ์หลุดแน่ๆ
// (วัดจริง 4 ก.ย. 2569 — คำว่า "ีufa191" หลุดไปถึง API แล้วเสีย $0.09 ฟรี)
const THAI_CANNOT_START = /^[ัิ-ฺ็-๎]/;

export function validateKeyword(raw) {
  const keyword = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!keyword) return { ok: false, reason: "กรุณากรอกคำค้นหา" };
  if (keyword.length > MAX_LENGTH) return { ok: false, reason: "คำค้นหายาวเกิน " + MAX_LENGTH + " ตัวอักษร" };
  if (THAI_CANNOT_START.test(keyword)) {
    return { ok: false, reason: "คำค้นหาขึ้นต้นด้วยสระหรือวรรณยุกต์ ลองตรวจว่าพิมพ์หลุดหรือเปล่า" };
  }
  const bad = keyword.match(INVALID_CHARS);
  if (bad) return { ok: false, reason: "ใช้อักขระ " + bad[0] + " ในคำค้นหาไม่ได้ Google Ads จะปฏิเสธทั้งคำขอ" };
  return { ok: true, keyword };
}

const okCode = (code) => typeof code === "number" && code >= 20000 && code <= 29999;

async function call(path, body) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      method: body ? "POST" : "GET",
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* ปล่อยให้ json เป็น null แล้วไปแจ้งเป็น api_error */ }
    return {
      ms: Date.now() - started,
      http: res.status,
      json,
      raw: json ? null : text.slice(0, 500),
      rateLimit: {
        limit: Number(res.headers.get("x-ratelimit-limit")) || null,
        remaining: Number(res.headers.get("x-ratelimit-remaining")),
      },
    };
  } catch (err) {
    const aborted = err.name === "AbortError";
    throw new DataForSeoError({
      code: aborted ? "timeout" : "network",
      userMessage: aborted
        ? "ระบบต้นทางตอบช้าเกินไป ลองใหม่อีกครั้ง"
        : "เชื่อมต่อระบบต้นทางไม่ได้ ลองใหม่อีกครั้ง",
      detail: (aborted ? "abort after " + TIMEOUT_MS + "ms" : String(err && err.message)) + " · " + path,
      status: 504,
    });
  } finally {
    clearTimeout(timer);
  }
}

// สำเร็จต้องผ่านสี่ด่าน ไม่ใช่ด่านเดียว — วัดจริง 4 ก.ย. 2569 พบว่าคำขอที่ชนเพดาน
// ตอบ HTTP 200 + status_code 20000 "Ok." แต่ cost เป็น 0 และไม่มีข้อมูล (PLAN ข้อ 2.4)
function unwrap(res, path) {
  if (!res.json) {
    throw new DataForSeoError({
      code: "api_error",
      userMessage: "ระบบต้นทางส่งข้อมูลที่อ่านไม่ได้",
      detail: "HTTP " + res.http + " · " + res.raw + " · " + path,
    });
  }
  if (res.http !== 200 || !okCode(res.json.status_code)) {
    throw new DataForSeoError({
      code: res.http === 401 ? "auth_error" : "api_error",
      userMessage: "ระบบต้นทางปฏิเสธคำขอ ทีมงานได้รับแจ้งแล้ว",
      detail: "HTTP " + res.http + " · resp " + res.json.status_code + " " + res.json.status_message + " · " + path,
    });
  }
  const task = res.json.tasks?.[0] ?? null;
  if (!task || !okCode(task.status_code)) {
    const message = task?.status_message || "ไม่มี task กลับมา";
    const invalid = String(task?.status_code) === "40501";
    throw new DataForSeoError({
      code: invalid ? "invalid_keyword" : "api_error",
      userMessage: invalid
        ? "คำค้นหานี้มีอักขระที่ Google Ads ไม่รับ ลองตัดสัญลักษณ์พิเศษออก"
        : "ระบบต้นทางประมวลผลคำขอไม่สำเร็จ",
      detail: "task " + task?.status_code + " " + message + " · " + path,
      status: invalid ? 400 : 502,
    });
  }

  const cost = Number(res.json.cost ?? 0);
  const rows = Array.isArray(task.result) ? task.result : [];
  if (cost <= 0 && rows.length === 0) {
    throw new DataForSeoError({
      code: "throttled",
      userMessage: "ตอนนี้มีคนใช้งานพร้อมกันเยอะ ระบบต้นทางชะลอคำขอไว้ ลองใหม่ในอีกสักครู่",
      detail: "cost=0 result=0 ทั้งที่ status 20000 · remaining=" + res.rateLimit.remaining + " · " + path,
      status: 503,
    });
  }

  return { rows, cost, ms: res.ms, rateLimit: res.rateLimit };
}

export async function fetchKeywordIdeas({ keyword, locationCode, languageCode, monthsBack = env.MONTHS_BACK }) {
  const res = await call(IDEAS, [{
    keywords: [keyword],
    location_code: locationCode,
    language_code: languageCode,
    date_from: dateFromForMonths(monthsBack),
  }]);
  return unwrap(res, IDEAS);
}

export async function fetchSearchVolume({ keywords, locationCode, languageCode, monthsBack = env.MONTHS_BACK }) {
  const res = await call(VOLUME, [{
    keywords,
    location_code: locationCode,
    language_code: languageCode,
    date_from: dateFromForMonths(monthsBack),
  }]);
  return unwrap(res, VOLUME);
}

// Labs คิดเงินแบบ ขั้นต่ำราว $0.012 ต่อคำขอ บวก $0.00012 ต่อผลลัพธ์ (วัดจริง 5 ก.ย. 2569)
//   100 คำ = $0.024   ·   300 คำ = $0.048   ·   700 คำ = $0.096 ซึ่งแพงกว่า Google Ads แล้ว
// ค่า limit จึงเป็นตัวคุมต้นทุนโดยตรง ห้ามขยับโดยไม่คิดเรื่องเงิน
//
// เทียบกับ keywords_for_keywords ที่ราคา $0.09 คงที่ — Labs ชนะขาดกับคำแบรนด์
// วัดจริง seed ufa191 ได้ 180 คำจาก Labs เทียบกับ 22 คำจาก Google Ads
// และตัวเลข volume ตรงกันทุกคำที่ทับกัน เพราะเป็นฐานข้อมูล Google Ads ชุดเดียวกัน
export async function fetchLabsSuggestions({ keyword, locationCode, languageCode, limit }) {
  const res = await call(SUGGESTIONS, [{
    keyword,
    location_code: locationCode,
    language_code: languageCode,
    limit,
    include_serp_info: false,
    include_clickstream_data: false,
  }]);
  const out = unwrapLabs(res, SUGGESTIONS);
  return { ...out, ms: res.ms, rateLimit: res.rateLimit };
}

// Labs ห่อผลไว้ลึกกว่า Google Ads หนึ่งชั้น — result[0].items แทนที่จะเป็น result ตรงๆ
// และ "ไม่เจอคำเลย" เป็นคำตอบที่ถูกต้อง ไม่ใช่ความผิดพลาด (วัดเจอกับ seed amd365)
function unwrapLabs(res, path) {
  if (!res.json) {
    throw new DataForSeoError({
      code: "api_error",
      userMessage: "ระบบต้นทางส่งข้อมูลที่อ่านไม่ได้",
      detail: "HTTP " + res.http + " · " + res.raw + " · " + path,
    });
  }
  if (res.http !== 200 || !okCode(res.json.status_code)) {
    throw new DataForSeoError({
      code: res.http === 401 ? "auth_error" : "api_error",
      userMessage: "ระบบต้นทางปฏิเสธคำขอ ทีมงานได้รับแจ้งแล้ว",
      detail: "HTTP " + res.http + " · resp " + res.json.status_code + " " + res.json.status_message + " · " + path,
    });
  }
  const task = res.json.tasks?.[0] ?? null;
  if (!task || !okCode(task.status_code)) {
    throw new DataForSeoError({
      code: "api_error",
      userMessage: "ระบบต้นทางประมวลผลคำขอไม่สำเร็จ",
      detail: "task " + task?.status_code + " " + (task?.status_message || "ไม่มี task") + " · " + path,
    });
  }

  const cost = Number(res.json.cost ?? 0);
  const result = task.result?.[0] ?? null;
  const items = Array.isArray(result?.items) ? result.items : [];

  if (cost <= 0 && !result) {
    throw new DataForSeoError({
      code: "throttled",
      userMessage: "ตอนนี้มีคนใช้งานพร้อมกันเยอะ ระบบต้นทางชะลอคำขอไว้ ลองใหม่ในอีกสักครู่",
      detail: "cost=0 และไม่มี result ทั้งที่ status ผ่าน · " + path,
      status: 503,
    });
  }

  return { items, cost, totalCount: result?.total_count ?? items.length };
}

// คำขอนี้ราคา $0 (วัดจริง 4 ก.ย. 2569) ใช้เช็กตอนบูตได้โดยไม่มีต้นทุน
export async function fetchAccount() {
  const res = await call(ACCOUNT);
  const result = res.json?.tasks?.[0]?.result?.[0] ?? null;
  return {
    ok: res.http === 200 && okCode(res.json?.status_code),
    balance: result?.money?.balance ?? null,
    timezone: result?.timezone ?? null,
    ms: res.ms,
    rateLimit: res.rateLimit,
  };
}
