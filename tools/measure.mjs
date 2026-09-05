import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// สคริปต์นี้รู้จักรหัสผ่าน DataForSEO ซึ่งขัดกับกฎ "services/dataforseo.js ต้องเป็นไฟล์เดียว
// ที่รู้" — ยอมได้เพราะตอนวัดยังไม่มี backend ให้ import · วันที่ backend เสร็จแล้ว
// ให้แก้ไฟล์นี้มาเรียกผ่าน service แทน แล้วลบส่วนอ่าน .env กับ AUTH ออก
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const die = (m) => { console.error("\n  x " + m + "\n"); process.exit(1); };

const Q = String.fromCharCode(34);
const SQ = String.fromCharCode(39);
const STRIP = new RegExp("^[" + Q + SQ + "]|[" + Q + SQ + "]$", "g");

function loadEnv() {
  let raw;
  try { raw = readFileSync(resolve(ROOT, ".env"), "utf8"); }
  catch { die("ไม่พบไฟล์ .env — คัดลอก .env.example เป็น .env แล้วเติม DATAFORSEO_LOGIN กับ DATAFORSEO_PASSWORD"); }
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(STRIP, "");
  }
  return env;
}

const env = loadEnv();
if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD)
  die("ยังไม่ได้ใส่ DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD ใน .env");

const BASE = (env.DATAFORSEO_BASE_URL || "https://api.dataforseo.com/v3").replace(/\/$/, "");
const AUTH = "Basic " + Buffer.from(env.DATAFORSEO_LOGIN + ":" + env.DATAFORSEO_PASSWORD).toString("base64");

const LOCATION = Number(env.KEYFIN_TEST_LOCATION || 2764);
const LANGUAGE = env.KEYFIN_TEST_LANGUAGE || "th";

const args = process.argv.slice(2);
const has = (f) => args.some((a) => a === f || a.startsWith(f + "="));
const val = (f, d) => { const a = args.find((x) => x.startsWith(f + "=")); return a ? a.split("=")[1] : d; };

const DATES = has("--dates");
const LABS = has("--labs");
const LABS_LIMIT = Number(val("--limit", 100)) || 100;
const LABS_SEEDS = val("--seeds", "").split(",").map((x) => x.trim()).filter(Boolean);
const LABS_BULK = has("--labs-bulk");
const BULK_WORDS = val("--words", "").split(",").map((x) => x.trim()).filter(Boolean);
const DATE_FROM = val("--from", "2024-08-01");
const RUN_ALL = has("--all");
const ACCOUNT_ONLY = has("--account");
const RUN_BURST = (has("--burst") || RUN_ALL) && !ACCOUNT_ONLY && !DATES && !LABS;
const RUN_BASE = (!has("--burst") || RUN_ALL) && !ACCOUNT_ONLY && !DATES && !LABS;
const BURST_N = Number(val("--burst", 15)) || 15;
const DRY = has("--dry");

const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTDIR = resolve(ROOT, "measurements", STAMP);

const saved = [];
function save(name, data) {
  mkdirSync(OUTDIR, { recursive: true });
  writeFileSync(resolve(OUTDIR, name + ".json"), JSON.stringify(data, null, 2), "utf8");
  saved.push(name + ".json");
}

async function call(path, body) {
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + path, {
      method: body ? "POST" : "GET",
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { }
    // DataForSEO แจ้งเพดานจริงมากับ header ของทุก response (ไกด์ทางการ 3 ก.ย. 2569)
    // อ่านฟรี ไม่ต้องจ่ายเงินยิงชนเพดานเพื่อหาตัวเลขนี้
    const rl = { limit: res.headers.get("x-ratelimit-limit"), remaining: res.headers.get("x-ratelimit-remaining") };
    return { ms: Math.round(performance.now() - t0), http: res.status, json, raw: json ? null : text.slice(0, 400), rl, err: null };
  } catch (e) {
    return { ms: Math.round(performance.now() - t0), http: null, json: null, raw: null, rl: null, err: String((e && e.message) || e) };
  }
}

async function accountInfo() {
  const r = await call("/appendix/user_data");
  if (r.http === 401) die("รหัสผ่านไม่ผ่าน (401) — ตรวจ DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD ใน .env");
  const res = r.json?.tasks?.[0]?.result?.[0] ?? null;
  return { money: res?.money ?? null, rates: res?.rates ?? null, price: res?.price ?? null,
           timezone: res?.timezone ?? null, ms: r.ms, rl: r.rl, json: r.json };
}

const task = (r) => r.json?.tasks?.[0] ?? null;
const rows = (r) => task(r)?.result ?? [];
const money = (n) => (n === null || n === undefined ? "—" : "$" + Number(n).toFixed(4));
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const show = (v) => (v === null || v === undefined ? "null" : String(v));

const rlOf = (r) => (r?.rl?.limit ? " · เพดาน/นาที " + r.rl.limit + " เหลือ " + r.rl.remaining : "");

// ช่วงที่ถือว่าสำเร็จคือ 20000-29999 ทั้งช่วง ไม่ใช่ 20000 ตัวเดียว (ไกด์ทางการ 3 ก.ย. 2569)
// เทียบเท่ากับ 20000 เฉยๆ จะรายงานคำขอที่สำเร็จว่าพัง แล้วเราจะไปแก้สิ่งที่ไม่ได้เสีย
const okCode = (c) => typeof c === "number" && c >= 20000 && c <= 29999;

function statusOf(r) {
  if (r.err) return "เน็ตพัง: " + r.err;
  if (r.http !== 200) return "HTTP " + r.http + " · " + (r.json?.status_message || r.raw || "");
  if (!okCode(r.json?.status_code)) return "resp " + r.json?.status_code + " · " + r.json?.status_message;
  const t = task(r);
  if (t && !okCode(t.status_code)) return "task " + t.status_code + " · " + t.status_message;
  return null;
}

const monthRange = (m) => (m && m.length
  ? m[m.length - 1].year + "-" + m[m.length - 1].month + " ถึง " + m[0].year + "-" + m[0].month
  : "ไม่มีข้อมูล");

// เอาคำที่ซื้อมาแล้วรอบก่อนมาใช้ซ้ำ แทนที่จะยิง keywords_for_keywords ใหม่เพื่อได้คำมาทดสอบ
// ประหยัดไปหนึ่งคำขอ และตรงกับการใช้งานจริงที่ขั้นสองรับคำต่อจากขั้นแรก
function prevKeywords() {
  try {
    for (const d of readdirSync(resolve(ROOT, "measurements")).sort().reverse()) {
      const f = resolve(ROOT, "measurements", d, "02-keywords-for-keywords.json");
      if (!existsSync(f)) continue;
      const r = JSON.parse(readFileSync(f, "utf8"))?.tasks?.[0]?.result ?? [];
      if (r.length) return r.map((x) => x.keyword);
    }
  } catch { }
  return SAFE;
}

const SAFE = ["hotel", "โรงแรม กรุงเทพ", "zxqwvbnmqplkkkzz"];
const WEIRD = ["ที่พัก 5 ดาว (พัทยา)", "b&b เชียงใหม่", "ประกันรถยนต์ ชั้น 1 ราคาถูก 2569"];

const plan = [];
if (RUN_BASE) plan.push(
  ["search_volume · คำที่รู้ผลล่วงหน้า", 1],
  ["keywords_for_keywords · seed = hotel", 1],
  ["search_volume · คำที่มีอักขระพิเศษ", 1],
);
if (RUN_BURST) plan.push(["ยิงพร้อมกัน " + BURST_N + " คำขอ", BURST_N]);
if (DATES) plan.push(
  ["date_from · keywords_for_keywords", 1],
  ["date_from · search_volume หลายคำพร้อมกัน", 1],
);
// Labs คิดตามจำนวนผลลัพธ์ $0.00012/คำ ไม่ใช่ต่อคำขอ (อ่านจากตารางราคาของบัญชี)
if (LABS_BULK) plan.push(["labs bulk_search_volume · " + BULK_WORDS.length + " คำ", 1]);
else if (LABS && LABS_SEEDS.length) plan.push(["labs keyword_suggestions x " + LABS_SEEDS.length + " seed", LABS_SEEDS.length]);
else if (LABS) plan.push(
  ["labs keyword_suggestions limit=" + LABS_LIMIT, 1],
  ["labs related_keywords limit=" + LABS_LIMIT, 1],
);
const planned = plan.reduce((a, x) => a + x[1], 0);

console.log("\n  === วัดจริงกับ DataForSEO ===\n");
console.log("  บัญชี      " + env.DATAFORSEO_LOGIN);
console.log("  ปลายทาง    " + BASE);
console.log("  ตลาด       location_code=" + LOCATION + " · language_code=" + LANGUAGE + "\n");
if (ACCOUNT_ONLY) console.log("  · " + pad("อ่านบัญชี + เพดาน (ไม่เสียเงิน)", 42) + lpad(0, 3) + " คำขอ");
for (const p of plan) console.log("  · " + pad(p[0], 42) + lpad(p[1], 3) + " คำขอ");
console.log("  " + "-".repeat(56));
console.log("  รวม " + planned + " คำขอ · ประมาณ " + money(planned * 0.09) + " (ราคาป้าย $0.09/คำขอ)\n");

if (DRY) { console.log("  --dry ยังไม่ยิงจริง จบแค่นี้\n"); process.exit(0); }

const before = await accountInfo();
if (!before.money) die("อ่านยอดเงินไม่ได้ — บัญชีอาจยังไม่ผ่าน verify (รอ ~5 นาที) หรือรหัสผิด");

console.log("  ยอดก่อนเริ่ม " + money(before.money.balance) + "  (ตอบใน " + before.ms + " ms)");
// rates ที่ user_data คืนมาคือ "ตัวนับที่ใช้ไปแล้ว" ไม่ใช่เพดานต่อนาที และยาว 30KB
// จึงพิมพ์เฉพาะบรรทัดที่ใช้ตัดสินใจ ของเต็มอยู่ใน 00-user-data-before.json แล้ว
const GA = before.price?.keywords_data?.google_ads;
const perReq = (o) => o?.live?.priority_normal?.[0]?.cost;
const costType = (o) => o?.live?.priority_normal?.[0]?.cost_type;
if (GA) {
  console.log("  ราคาที่บัญชีแจ้งเอง (ไม่ใช่ตัวเลขจากหน้าเว็บ) · cost_type = " + costType(GA.search_volume));
  console.log("    search_volume/live          " + money(perReq(GA.search_volume)));
  console.log("    keywords_for_keywords/live  " + money(perReq(GA.keywords_for_keywords)));
  console.log("    keywords_for_site/live      " + money(perReq(GA.keywords_for_site)));
}
const CS = before.price?.keywords_data?.clickstream_data;
if (CS) console.log("    (เทียบ) clickstream/dataforseo_search_volume/live " + money(perReq(CS.dataforseo_search_volume)));
if (before.timezone) console.log("  เขตเวลาของบัญชี " + before.timezone + " · ตัวนับรายวันของ DataForSEO ตัดรอบตามนี้");
const dayCap = before.money?.limits?.day?.total;
if (dayCap !== undefined && dayCap !== null) console.log("  เพดานใช้จ่ายต่อวันที่บัญชีตั้งไว้ " + money(dayCap));
console.log("  header X-RateLimit " + (before.rl?.limit
  ? before.rl.limit + " ต่อนาที · เหลือ " + before.rl.remaining
  : "ไม่มีมากับ response  <- ต้องพึ่งการยิงชนเพดานอย่างเดียว"));
if (before.rl?.limit) console.log("  ^ header เป็นรายเอนด์พอยต์ ตัวนี้คือของ user_data · ของ Google Ads Live ขึ้น 12 (PLAN ข้อ 2.8)");
save("00-user-data-before", before.json);
console.log("");

if (ACCOUNT_ONLY) {
  console.log("  --account จบแค่นี้ ยังไม่มีคำขอที่เสียเงินสักตัว");
  console.log("  response ดิบ: " + OUTDIR);
  console.log("");
  process.exit(0);
}

const results = {};

if (RUN_BASE) {
  console.log("  -- 1. search_volume · คำที่รู้ผลล่วงหน้า " + "-".repeat(18));
  const a = await call("/keywords_data/google_ads/search_volume/live",
    [{ keywords: SAFE, location_code: LOCATION, language_code: LANGUAGE }]);
  save("01-search-volume-safe", a.json);
  results.safe = a;
  const e1 = statusOf(a);
  if (e1) console.log("  x " + e1);
  else {
    console.log("  ตอบใน " + a.ms + " ms · cost ที่ API แจ้ง " + money(a.json.cost) + " · ได้ " + rows(a).length + " แถว" + rlOf(a) + "\n");
    console.log("  " + pad("คำ", 22) + lpad("volume", 9) + lpad("cpc", 9) + lpad("comp", 9) + lpad("idx", 6) + "  ย้อนหลัง");
    for (const r of rows(a))
      console.log("  " + pad(r.keyword, 22) + lpad(show(r.search_volume), 9) + lpad(show(r.cpc), 9) +
        lpad(show(r.competition), 9) + lpad(show(r.competition_index), 6) +
        "  " + (r.monthly_searches?.length ?? 0) + " เดือน");
    const nulls = rows(a).filter((r) => r.search_volume === null);
    console.log("\n  search_volume เป็น null " + nulls.length + " คำ" +
      (nulls.length ? " (" + nulls.map((r) => r.keyword).join(", ") + ")  <- ยืนยัน PLAN ข้อ 2.2"
                    : "  <- คำมั่วก็ไม่ได้ null ต้องหาเคสอื่น"));
  }
  console.log("");

  console.log("  -- 2. keywords_for_keywords · seed = hotel " + "-".repeat(14));
  const b = await call("/keywords_data/google_ads/keywords_for_keywords/live",
    [{ keywords: ["hotel"], location_code: LOCATION, language_code: LANGUAGE }]);
  save("02-keywords-for-keywords", b.json);
  results.kfk = b;
  const e2 = statusOf(b);
  if (e2) console.log("  x " + e2);
  else {
    const rr = rows(b);
    console.log("  ตอบใน " + b.ms + " ms · cost ที่ API แจ้ง " + money(b.json.cost) + " · ได้ " + rr.length + " คำ" + rlOf(b));
    const nn = rr.filter((r) => r.search_volume === null).length;
    console.log("  ในนั้น search_volume เป็น null " + nn + " คำ (" + (rr.length ? Math.round(nn / rr.length * 100) : 0) + "%)");
    if (rr[0]) {
      const keys = Object.keys(rr[0]);
      console.log("\n  field ที่ได้กลับมา:\n    " + keys.join(" · "));
      const dev = keys.filter((k) => /device|mobile|desktop|tablet|platform/i.test(k));
      console.log("\n  field แยกอุปกรณ์: " + (dev.length ? dev.join(" · ") : "ไม่มีเลย  <- ยืนยัน PLAN ข้อ 2.7"));
      console.log("  monthly_searches: " + (rr[0].monthly_searches?.length ?? 0) + " เดือน · แถวแรก " +
        JSON.stringify(rr[0].monthly_searches?.[0] ?? null));
      const bid = keys.filter((k) => /bid|cpc/i.test(k));
      console.log("  field เกี่ยวกับเงิน: " + (bid.length ? bid.join(" · ") : "ไม่มี  <- ผิดจากที่คาด"));
    }
  }
  console.log("");

  console.log("  -- 3. search_volume · อักขระพิเศษ " + "-".repeat(23));
  const c = await call("/keywords_data/google_ads/search_volume/live",
    [{ keywords: WEIRD, location_code: LOCATION, language_code: LANGUAGE }]);
  save("03-search-volume-weird", c.json);
  results.weird = c;
  const e3 = statusOf(c);
  if (e3) console.log("  x " + e3 + "\n  <- ทั้งคำขอตกเพราะคำเดียว ต้องกรอง input ก่อนส่ง");
  else {
    console.log("  ตอบใน " + c.ms + " ms · ส่งไป " + WEIRD.length + " คำ ได้กลับ " + rows(c).length + " แถว");
    for (const r of rows(c)) console.log("    " + pad(r.keyword, 34) + lpad(show(r.search_volume), 8));
    const got = new Set(rows(c).map((r) => String(r.keyword).toLowerCase()));
    const dropped = WEIRD.filter((k) => !got.has(k.toLowerCase()));
    if (dropped.length) console.log("  หายไปเงียบๆ: " + dropped.join(" · ") + "  <- ต้องบอกผู้ใช้ (CLAUDE.md ข้อ 4)");
  }
  console.log("");
}

if (RUN_BURST) {
  console.log("  -- 4. ยิงพร้อมกัน " + BURST_N + " คำขอ " + "-".repeat(26));
  const fired = await Promise.all(
    Array.from({ length: BURST_N }, (_, i) =>
      call("/keywords_data/google_ads/search_volume/live",
        [{ keywords: ["ทดสอบเพดาน " + i], location_code: LOCATION, language_code: LANGUAGE }])
        .then((r) => Object.assign({ i }, r))));
  save("04-burst", fired.map((r) => ({
    i: r.i, ms: r.ms, http: r.http,
    status_code: r.json?.status_code, status_message: r.json?.status_message, cost: r.json?.cost, rl: r.rl,
    task_status_code: task(r)?.status_code, task_status_message: task(r)?.status_message,
    result_count: task(r)?.result_count, task_cost: task(r)?.cost,
  })));
  results.burst = fired;

  const throttled = fired.filter((r) => !statusOf(r) && !r.json?.cost);
  const fail = fired.filter((r) => statusOf(r) || !r.json?.cost);
  const times = fired.map((r) => r.ms).sort((a, b) => a - b);
  console.log("  สำเร็จ " + (fired.length - fail.length) + " · ถูกปฏิเสธ " + fail.length + " จาก " + BURST_N);
  console.log("  เวลาตอบ  ต่ำสุด " + times[0] + " ms · กลาง " + times[times.length >> 1] +
    " ms · สูงสุด " + times[times.length - 1] + " ms");
  const lim = [...new Set(fired.map((r) => r.rl?.limit).filter(Boolean))];
  const rem = fired.map((r) => Number(r.rl?.remaining)).filter((n) => Number.isFinite(n));
  if (lim.length) console.log("  header แจ้งเพดาน " + lim.join("/") + " ต่อนาที · เหลือน้อยสุดระหว่างยิง " + Math.min(...rem));
  const reasons = new Map();
  for (const r of fail) { const s = statusOf(r); reasons.set(s, (reasons.get(s) || 0) + 1); }
  for (const [s, n] of reasons) console.log("  เหตุที่ถูกปฏิเสธ x" + n + ": " + s);
  if (throttled.length) console.log("  ในนั้น " + throttled.length + " ตัวตอบ 20000 Ok. แต่ cost=0 (โดนเบรกเงียบๆ)" +
    "  <- ห้ามนับว่าสำเร็จ ห้ามหักเครดิต (PLAN ข้อ 2.4)");
  if (!fail.length) console.log("  <- ยังไม่ชนเพดาน ลองเพิ่ม --burst=" + (BURST_N + 10));
  console.log("");
}

// ตัวเทียบของ google_ads/search_volume — ส่งคำไปเท่าไหร่ได้กลับเท่านั้น ไม่สร้างคำใหม่
// ต้องรู้ก่อนว่าคืน monthly_searches มาด้วยไหม ถ้าไม่คืนโหมดหลายคำจะไม่มีกราฟ
if (LABS_BULK) {
  const r = await call("/dataforseo_labs/google/" + val("--endpoint", "keyword_overview") + "/live",
    [{ keywords: BULK_WORDS, location_code: LOCATION, language_code: LANGUAGE }]);
  save("09-labs-bulk-search-volume", r.json);
  const e = statusOf(r);
  if (e) console.log("  x " + e);
  else {
    const res = task(r)?.result?.[0] ?? {};
    const items = res.items ?? [];
    console.log("  ตอบใน " + r.ms + " ms · cost " + money(r.json.cost) + " · ส่งไป " + BULK_WORDS.length + " คำ ได้กลับ " + items.length + " คำ" + rlOf(r));
    if (items[0]) {
      console.log("  field ชั้นบน: " + Object.keys(items[0]).join(" · "));
      const info = items[0].keyword_info ?? {};
      console.log("  keyword_info: " + Object.keys(info).join(" · "));
      const m = info.monthly_searches;
      console.log("  monthly_searches: " + (Array.isArray(m) ? m.length + " เดือน · ล่าสุด " + m[0].year + "-" + m[0].month : "ไม่มี  <- โหมดหลายคำจะไม่มีกราฟ"));
    }
    console.log("");
    console.log("  " + pad("คำ", 16) + lpad("volume", 9) + lpad("เดือน", 7) + lpad("cpc", 8) + lpad("comp", 7));
    for (const x of items) {
      const i = x.keyword_info ?? {};
      console.log("  " + pad(x.keyword, 16) + lpad(show(i.search_volume), 9) +
        lpad(Array.isArray(i.monthly_searches) ? i.monthly_searches.length : 0, 7) +
        lpad(show(i.cpc), 8) + lpad(show(i.competition_level ?? i.competition), 7));
    }
    const got = new Set(items.map((x) => String(x.keyword).toLowerCase()));
    const miss = BULK_WORDS.filter((k) => !got.has(k.toLowerCase()));
    if (miss.length) console.log("  ส่งไปแล้วไม่ได้กลับมา: " + miss.join(" · "));
    console.log("  ราคาต่อคำ " + money(items.length ? (r.json.cost || 0) / items.length : 0));
  }
  console.log("");
} else if (LABS && LABS_SEEDS.length) {
  const norm = (k) => String(k).toLowerCase().replace(/[-_.]/g, " ").replace(/s+/g, "");
  console.log("  " + pad("seed", 14) + lpad("ได้มา", 7) + lpad("ทั้งหมด", 9) + lpad("ไม่ซ้ำ", 8) + lpad("volume", 12) + lpad("cost", 10) + lpad("ms", 7));
  let total = 0;
  for (const seed of LABS_SEEDS) {
    const r = await call("/dataforseo_labs/google/keyword_suggestions/live",
      [{ keyword: seed, location_code: LOCATION, language_code: LANGUAGE, limit: LABS_LIMIT }]);
    save("labs-" + seed.replace(/[^a-z0-9]+/gi, "-"), r.json);
    const e = statusOf(r);
    if (e) { console.log("  " + pad(seed, 14) + "  x " + e); continue; }
    const res = task(r)?.result?.[0] ?? {};
    const items = res.items ?? [];
    const uniq = new Set(items.map((x) => norm(x.keyword)));
    const vol = [...new Map(items.map((x) => [norm(x.keyword), x])).values()]
      .reduce((a, x) => a + (x.keyword_info?.search_volume || 0), 0);
    total += Number(r.json.cost) || 0;
    console.log("  " + pad(seed, 14) + lpad(items.length, 7) + lpad(res.total_count ?? "—", 9) +
      lpad(uniq.size, 8) + lpad(vol.toLocaleString(), 12) + lpad(money(r.json.cost), 10) + lpad(r.ms, 7));
  }
  console.log("");
  console.log("  รวมค่าใช้จ่าย " + money(total) + " จาก " + LABS_SEEDS.length + " seed");
  console.log("");
} else if (LABS) {
  const seed = val("--seed", "7-11 game");
  const report = (name, r, path) => {
    save(name, r.json);
    const e = statusOf(r);
    if (e) { console.log("  x " + e); return null; }
    const t = task(r);
    const res = t?.result?.[0] ?? null;
    const items = res?.items ?? [];
    console.log("  ตอบใน " + r.ms + " ms · cost " + money(r.json.cost) + " · ได้ " + items.length + " คำ" +
      " · ทั้งหมดที่มี " + (res?.total_count ?? "—") + rlOf(r));
    if (items.length) console.log("    ราคาต่อคำ " + money((r.json.cost || 0) / items.length));
    return items;
  };

  console.log("  -- 7. labs keyword_suggestions · seed = " + seed + " " + "-".repeat(8));
  const l1 = await call("/dataforseo_labs/google/keyword_suggestions/live",
    [{ keyword: seed, location_code: LOCATION, language_code: LANGUAGE, limit: LABS_LIMIT }]);
  const items1 = report("07-labs-keyword-suggestions", l1, "keyword_suggestions");
  results.labsA = l1;
  if (items1 && items1.length) {
    const one = items1[0];
    const info = one.keyword_info || {};
    console.log("    field ชั้นบน: " + Object.keys(one).join(" · "));
    console.log("    keyword_info: " + Object.keys(info).join(" · "));
    console.log("    ตัวอย่าง " + one.keyword + " · volume " + show(info.search_volume) +
      " · cpc " + show(info.cpc) + " · competition " + show(info.competition) + " (" + show(info.competition_level) + ")");
    console.log("    monthly_searches " + (info.monthly_searches?.length ?? 0) + " เดือน" +
      (info.monthly_searches?.length ? " · ล่าสุด " + info.monthly_searches[0].year + "-" + info.monthly_searches[0].month : ""));
    const nulls = items1.filter((x) => x.keyword_info?.search_volume === null).length;
    console.log("    search_volume เป็น null " + nulls + " คำจาก " + items1.length);
    console.log("    ห้าคำแรก: " + items1.slice(0, 5).map((x) => x.keyword + "(" + show(x.keyword_info?.search_volume) + ")").join(" · "));
  }
  console.log("");

  console.log("  -- 8. labs related_keywords · seed = " + seed + " " + "-".repeat(10));
  const l2 = await call("/dataforseo_labs/google/related_keywords/live",
    [{ keyword: seed, location_code: LOCATION, language_code: LANGUAGE, depth: 1, limit: LABS_LIMIT }]);
  const items2 = report("08-labs-related-keywords", l2, "related_keywords");
  results.labsB = l2;
  if (items2 && items2.length) {
    const one = items2[0];
    console.log("    field ชั้นบน: " + Object.keys(one).join(" · "));
    const kd = one.keyword_data || {};
    console.log("    keyword_data: " + Object.keys(kd).join(" · "));
    console.log("    ห้าคำแรก: " + items2.slice(0, 5).map((x) => (x.keyword_data?.keyword ?? x.keyword) + "(" + show(x.keyword_data?.keyword_info?.search_volume) + ")").join(" · "));
    console.log("    monthly_searches " + (kd.keyword_info?.monthly_searches?.length ?? 0) + " เดือน");
  }
  console.log("");
}

if (DATES) {
  console.log("  -- 5. keywords_for_keywords + date_from=" + DATE_FROM + " " + "-".repeat(12));
  const d1 = await call("/keywords_data/google_ads/keywords_for_keywords/live",
    [{ keywords: ["hotel"], location_code: LOCATION, language_code: LANGUAGE, date_from: DATE_FROM }]);
  save("05-kfk-date-from", d1.json);
  results.datesA = d1;
  const e5 = statusOf(d1);
  if (e5) console.log("  x " + e5 + NL + "  <- keywords_for_keywords ไม่รับ date_from ต้องยิงสองคำขอ");
  else {
    const rr = rows(d1);
    const m = rr[0]?.monthly_searches;
    console.log("  ตอบใน " + d1.ms + " ms · cost " + money(d1.json.cost) + " · ได้ " + rr.length + " คำ" + rlOf(d1));
    console.log("  monthly_searches " + (m?.length ?? 0) + " เดือน · " + monthRange(m));
    console.log("  " + ((m?.length ?? 0) > 12
      ? "<- รับ date_from จริง ได้ยาวกว่า 12 เดือนในคำขอเดียว ไม่ต้องจ่ายเพิ่ม"
      : "<- ยังได้ 12 เดือนเท่าเดิม date_from ถูกเมินเงียบๆ (ต้องบอกผู้ใช้ ห้ามโชว์เหมือนได้ 24)"));
  }
  console.log("");

  console.log("  -- 6. search_volume + date_from · ส่งคำที่ซื้อมาแล้วทั้งชุด " + "-".repeat(6));
  const seeds = prevKeywords();
  console.log("  ส่งไป " + seeds.length + " คำในคำขอเดียว");
  const d2 = await call("/keywords_data/google_ads/search_volume/live",
    [{ keywords: seeds, location_code: LOCATION, language_code: LANGUAGE, date_from: DATE_FROM }]);
  save("06-sv-date-from", d2.json);
  results.datesB = d2;
  const e6 = statusOf(d2);
  if (e6) console.log("  x " + e6);
  else {
    const rr = rows(d2);
    const m = rr[0]?.monthly_searches;
    console.log("  ตอบใน " + d2.ms + " ms · cost " + money(d2.json.cost) + " · ได้กลับ " + rr.length + " แถว" + rlOf(d2));
    console.log("  monthly_searches " + (m?.length ?? 0) + " เดือน · " + monthRange(m));
    console.log("  ส่ง " + seeds.length + " คำ ราคาเท่าเดิม = " + money(rr.length ? (d2.json.cost || 0) / rr.length : 0) + " ต่อคำ");
    const missing = seeds.length - rr.length;
    if (missing > 0) console.log("  หายไป " + missing + " คำ  <- ต้องรู้ว่าหายเพราะอะไรก่อนเอาไปใช้จริง");
  }
  console.log("");
}

const after = await accountInfo();
save("99-user-data-after", after.json);
const spent = before.money.balance - after.money.balance;

console.log("  === สรุป ===\n");
console.log("  ยอดก่อน " + money(before.money.balance) + " -> หลัง " + money(after.money.balance));
const okAll = [results.safe, results.kfk, results.weird, results.datesA, results.datesB, results.labsA, results.labsB, ...(results.burst || [])]
  .filter(Boolean).filter((r) => !statusOf(r)).length;
console.log("  จ่ายจริง " + money(spent) + " จาก " + planned + " คำขอที่วางแผน · สำเร็จจริง " + okAll);
console.log("  = " + money(okAll ? spent / okAll : 0) + " ต่อคำขอที่สำเร็จ  (ราคาป้าย $0.0900)");
console.log("    หารด้วยจำนวนที่สำเร็จ ไม่ใช่ที่วางแผน เพราะคำขอที่ถูกปฏิเสธไม่เสียเงิน");
if (results.kfk && !statusOf(results.kfk)) {
  const n = rows(results.kfk).length;
  const c = task(results.kfk)?.cost ?? results.kfk.json?.cost;
  console.log("  keywords_for_keywords: " + money(c) + " ได้ " + n + " คำ = " + money(n ? c / n : 0) + " ต่อคำ");
}
console.log("\n  response ดิบเก็บไว้ที่\n  " + OUTDIR);
for (const f of saved) console.log("    · " + f);
console.log("\n  เอาตัวเลขพวกนี้ใส่กลับเข้า PLAN.md พร้อมวันที่ (PLAN ข้อ 8)\n");
