import { env } from "../config/env.js";
import { validateKeyword, fetchKeywordIdeas, fetchSearchVolume, fetchLabsSuggestions, DataForSeoError } from "./dataforseo.js";
import { normalizeRows, normalizeLabsRows, summarize, withTabs, markDuplicates, withFreshTrend } from "./normalize.js";
import { readCache, readManyCache, makeKey, cacheKey, METRICS, IDEAS, LABS } from "./cache.js";
import { schedule, estimateWaitSeconds } from "./queue.js";
import {
  assertHasCredit,
  commitPaidSearch,
  commitBulkSearch,
  commitCachedSearch,
  commitFailedSearch,
  QuotaError,
} from "./credits.js";
import { withTransaction } from "../db/index.js";
import { thaiDate } from "../lib/time.js";

export class InputError extends Error {
  constructor(message) {
    super(message);
    this.code = "invalid_keyword";
    this.status = 400;
  }
}

// จำกัดจำนวนแถวของสมาชิก Free ได้ แต่ต้องบอกเสมอว่าตัดไปเท่าไหร่และเพราะอะไร
// ตัวเลขที่ไม่ครบโดยไม่มีใครรู้ อันตรายกว่าหน้าที่โหลดช้า (CLAUDE.md กฎข้อ 4)
function applyPlanLimit(rows, user) {
  if (user.role !== "free" || rows.length <= env.FREE_ROW_LIMIT) {
    return { rows, truncated: null };
  }
  return {
    rows: rows.slice(0, env.FREE_ROW_LIMIT),
    truncated: {
      shown: env.FREE_ROW_LIMIT,
      total: rows.length,
      hidden: rows.length - env.FREE_ROW_LIMIT,
      reason: "สมาชิก Free ดูได้ " + env.FREE_ROW_LIMIT + " คำแรก อัปเกรดเพื่อดูครบทุกคำ",
    },
  };
}

// สรุปตัวเลขคิดตอนอ่าน ไม่ใช่ตอนเขียนลงแคช — เวลาที่แก้สูตรสรุป (เช่นเรื่องคำซ้ำ)
// ของที่อยู่ในแคชแล้วจะได้ตัวเลขใหม่ทันทีโดยไม่ต้องจ่ายเงินยิงซ้ำ
function present({ payload, user, source, fetchedAt, ageDays, credits, meta }) {
  const rows = markDuplicates(withFreshTrend(payload.rows), payload.keyword);
  const limited = applyPlanLimit(rows, user);
  return {
    keyword: payload.keyword,
    locationCode: payload.locationCode,
    languageCode: payload.languageCode,
    source,
    fetchedAt,
    fetchedAtThai: thaiDate(fetchedAt),
    ageDays,
    monthsBack: payload.monthsBack,
    engine: payload.engine ?? "google_ads",
    sourceTotal: payload.totalCount ?? payload.rows.length,
    summary: summarize(rows),
    rows: limited.rows,
    truncated: limited.truncated,
    credits,
    meta,
  };
}

export async function runSearch({ user, keyword: rawKeyword, locationCode, languageCode }) {
  const check = validateKeyword(rawKeyword);
  if (!check.ok) {
    await commitFailedSearch({
      userId: user.id,
      keyword: String(rawKeyword ?? "").slice(0, 200),
      locationCode,
      languageCode,
      status: "invalid_keyword",
      error: check.reason,
    }).catch(() => {});
    throw new InputError(check.reason);
  }

  const keyword = check.keyword;
  const startedAt = Date.now();

  await withTransaction((client) => assertHasCredit(client, user.id));

  // แยกแคชตามเครื่องยนต์ที่ใช้ดึง — Labs กับ Google Ads คืนคนละชุดคำสำหรับ seed เดียวกัน
  // ถ้าใช้ช่องเดียวกัน วันที่สลับเครื่องยนต์จะเสิร์ฟของเก่าที่ไม่ตรงกับที่ผู้ใช้คาด
  const useLabs = env.ENGINE === "labs";
  const kind = useLabs ? LABS : IDEAS;

  const cached = await readCache({ keyword, locationCode, languageCode, kind });
  if (cached?.stale) {
    console.log("[cache] ข้ามแคชของ " + keyword + " · " + cached.stale);
  }
  if (cached?.payload) {
    const credits = await commitCachedSearch({
      userId: user.id,
      keyword,
      locationCode,
      languageCode,
      meta: { resultCount: cached.payload.rows.length, durationMs: Date.now() - startedAt },
    });
    return present({
      payload: cached.payload,
      user,
      source: "cache",
      fetchedAt: cached.fetchedAt,
      ageDays: cached.ageDays,
      credits,
      meta: { durationMs: Date.now() - startedAt, deduped: false, queuePosition: 0 },
    });
  }

  const key = makeKey({ keyword, locationCode, languageCode, kind });
  const job = schedule({
    userId: String(user.id),
    key,
    run: () => (useLabs
      ? fetchLabsSuggestions({ keyword, locationCode, languageCode, limit: env.LABS_LIMIT })
      : fetchKeywordIdeas({ keyword, locationCode, languageCode })),
  });

  let api;
  try {
    api = await job.promise;
  } catch (err) {
    const known = err instanceof DataForSeoError;
    const status = known && ["timeout", "throttled", "invalid_keyword"].includes(err.code)
      ? (err.code === "timeout" ? "timeout" : err.code === "throttled" ? "throttled" : "invalid_keyword")
      : "api_error";
    await commitFailedSearch({
      userId: user.id,
      keyword,
      locationCode,
      languageCode,
      status,
      meta: { durationMs: Date.now() - startedAt },
      error: known ? err.detail : String(err && err.message),
    }).catch(() => {});
    throw err;
  }

  const rows = withTabs(useLabs ? normalizeLabsRows(api.items) : normalizeRows(api.rows));
  const payload = {
    keyword,
    locationCode,
    languageCode,
    engine: env.ENGINE,
    // Labs ให้ 12 เดือน ส่วน Google Ads ขอได้ 24 · เก็บค่าที่ได้จริงไว้กับผลลัพธ์
    // ไม่ใช่ค่าจาก env เพราะแคชเก่าอาจมาจากเครื่องยนต์อื่นที่ให้ช่วงต่างกัน
    monthsBack: rows[0]?.months?.length ?? (useLabs ? 12 : env.MONTHS_BACK),
    totalCount: useLabs ? api.totalCount : rows.length,
    rows,
  };

  // ได้ข้อมูลมาโดยไม่ถูกคิดเงิน (cost = 0) ก็ไม่หักเครดิต — เราไม่ได้จ่าย ผู้ใช้ก็ไม่ต้องจ่าย
  const charged = Number(api.cost) > 0;
  const credits = await commitPaidSearch({
    userId: user.id,
    keyword,
    locationCode,
    languageCode,
    payload,
    kind,
    charge: charged,
    meta: {
      resultCount: rows.length,
      durationMs: Date.now() - startedAt,
      apiCost: api.cost,
    },
  });

  return present({
    payload,
    user,
    source: "live",
    fetchedAt: new Date().toISOString(),
    ageDays: 0,
    credits,
    meta: {
      durationMs: Date.now() - startedAt,
      apiMs: api.ms,
      deduped: job.deduped,
      queuePosition: job.position,
      estimatedWaitSeconds: estimateWaitSeconds(job.position),
    },
  });
}

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

// โหมดหลายคำใช้ search_volume/live ซึ่ง "ส่งไปกี่คำได้กลับเท่านั้น" ไม่สร้างคำใหม่
// วัดจริง 4 ก.ย. 2569 — ส่ง 356 คำในคำขอเดียวได้ครบทั้ง 356 แถว ราคา $0.09 เท่าเดิม
export async function runBulkSearch({ user, keywords: rawList, locationCode, languageCode }) {
  const startedAt = Date.now();

  const seen = new Set();
  const valid = [];
  const invalid = [];
  for (const raw of Array.isArray(rawList) ? rawList : []) {
    const check = validateKeyword(raw);
    if (!check.ok) {
      if (String(raw ?? "").trim()) invalid.push({ keyword: String(raw).trim().slice(0, 80), reason: check.reason });
      continue;
    }
    const key = cacheKey(check.keyword);
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(check.keyword);
  }

  if (!valid.length) throw new InputError(invalid.length ? invalid[0].reason : "กรุณากรอกคำค้นหาอย่างน้อยหนึ่งคำ");

  const overflow = valid.length > env.BULK_MAX ? valid.length - env.BULK_MAX : 0;
  const list = valid.slice(0, env.BULK_MAX);

  await withTransaction((client) => assertHasCredit(client, user.id));

  const hits = await readManyCache({ keywords: list, locationCode, languageCode });
  const missing = list.filter((k) => !hits.has(cacheKey(k)));
  const batches = chunk(missing, env.BULK_CHUNK);

  const fresh = new Map();
  let apiCost = 0;
  let apiMs = 0;

  for (const batch of batches) {
    const job = schedule({
      userId: String(user.id),
      key: "bulk|" + locationCode + "|" + languageCode + "|" + batch.join("|").slice(0, 200),
      run: () => fetchSearchVolume({ keywords: batch, locationCode, languageCode }),
    });
    let api;
    try {
      api = await job.promise;
    } catch (err) {
      const known = err instanceof DataForSeoError;
      await commitFailedSearch({
        userId: user.id,
        keyword: batch[0] + " +" + (batch.length - 1) + " คำ",
        locationCode,
        languageCode,
        status: known && ["timeout", "throttled", "invalid_keyword"].includes(err.code) ? err.code : "api_error",
        meta: { durationMs: Date.now() - startedAt, apiCost },
        error: known ? err.detail : String(err && err.message),
      }).catch(() => {});
      throw err;
    }
    apiCost += Number(api.cost) || 0;
    apiMs += api.ms;
    for (const row of normalizeRows(api.rows)) fresh.set(cacheKey(row.keyword), row);
  }

  const entries = [...fresh.entries()].map(([, row]) => ({
    keyword: row.keyword,
    locationCode,
    languageCode,
    kind: METRICS,
    payload: { keyword: row.keyword, locationCode, languageCode, monthsBack: env.MONTHS_BACK, rows: [row] },
  }));

  const credits = await commitBulkSearch({
    userId: user.id,
    keyword: list[0] + (list.length > 1 ? " +" + (list.length - 1) + " คำ" : ""),
    locationCode,
    languageCode,
    entries,
    charge: batches.length ? 1 : 0,
    meta: { resultCount: hits.size + fresh.size, durationMs: Date.now() - startedAt, apiCost },
  });

  const rows = [];
  const notFound = [];
  for (const keyword of list) {
    const key = cacheKey(keyword);
    const hit = hits.get(key);
    if (hit) rows.push({ ...hit.payload.rows[0], fromCache: true });
    else if (fresh.has(key)) rows.push({ ...fresh.get(key), fromCache: false });
    else notFound.push(keyword);
  }
  rows.sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));

  const marked = markDuplicates(withFreshTrend(rows), "");
  const limited = applyPlanLimit(marked, user);

  return {
    mode: "bulk",
    keyword: list[0] + (list.length > 1 ? " และอีก " + (list.length - 1) + " คำ" : ""),
    locationCode,
    languageCode,
    source: batches.length ? "live" : "cache",
    fetchedAt: new Date().toISOString(),
    fetchedAtThai: thaiDate(new Date().toISOString()),
    ageDays: 0,
    monthsBack: env.MONTHS_BACK,
    summary: summarize(marked),
    rows: limited.rows,
    truncated: limited.truncated,
    credits,
    notFound,
    invalid,
    overflow,
    meta: {
      durationMs: Date.now() - startedAt,
      apiMs,
      apiCost,
      requested: list.length,
      fromCache: hits.size,
      fetched: fresh.size,
      requests: batches.length,
    },
  };
}

export { QuotaError };
