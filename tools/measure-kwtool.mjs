import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// สคริปต์นี้รู้จัก API key ของ KeywordTool ซึ่งขัดกับกฎ "ไฟล์เดียวที่รู้ความลับ"
// ยอมได้เพราะยังเป็นขั้นวัด ยังไม่มี service ให้ import · วันที่ตัดสินใจใช้จริงแล้ว
// ให้ย้ายไปเรียกผ่าน services/keywordtool.js แล้วลบส่วนอ่าน .env ออก
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const die = (m) => { console.error("\n  x " + m + "\n"); process.exit(1); };

const Q = String.fromCharCode(34);
const SQ = String.fromCharCode(39);
const STRIP = new RegExp("^[" + Q + SQ + "]|[" + Q + SQ + "]$", "g");

function loadEnv() {
  let raw;
  try { raw = readFileSync(resolve(ROOT, ".env"), "utf8"); }
  catch { die("ไม่พบไฟล์ .env"); }
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(STRIP, "");
  }
  return env;
}

const env = loadEnv();
if (!env.KEYWORDTOOL_APIKEY) die("ยังไม่ได้ใส่ KEYWORDTOOL_APIKEY ใน .env");

const APIKEY = env.KEYWORDTOOL_APIKEY;
const args = process.argv.slice(2);
const has = (f) => args.some((a) => a === f || a.startsWith(f + "="));
const val = (f, d) => { const a = args.find((x) => x.startsWith(f + "=")); return a ? a.split("=")[1] : d; };

const DRY = has("--dry");
const SANDBOX = has("--sandbox");
const QUOTA_ONLY = has("--quota");
const SEED = val("--seed", "7-11 game");

// sandbox ไม่กินโควตา ใช้ตรวจรูปแบบคำขอก่อนยิงของจริงได้ฟรี
const BASE = "https://api.keywordtool.io/" + (SANDBOX ? "v2-sandbox" : "v2");
const COUNTRY = val("--country", "TH");
const LANGUAGE = val("--language", "th");
const LOCATION = Number(val("--location", 2764));

const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTDIR = resolve(ROOT, "measurements", "kwtool-" + STAMP);
const saved = [];
function save(name, data) {
  mkdirSync(OUTDIR, { recursive: true });
  writeFileSync(resolve(OUTDIR, name + ".json"), JSON.stringify(data, null, 2), "utf8");
  saved.push(name + ".json");
}

async function call(path, body) {
  const t0 = performance.now();
  try {
    const url = BASE + path + (body ? "" : (path.includes("?") ? "&" : "?") + "apikey=" + encodeURIComponent(APIKEY));
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify({ apikey: APIKEY, ...body }) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { }
    return { ms: Math.round(performance.now() - t0), http: res.status, json, raw: json ? null : text.slice(0, 400) };
  } catch (e) {
    return { ms: Math.round(performance.now() - t0), http: null, json: null, raw: String((e && e.message) || e) };
  }
}

const flatten = (results) => {
  const seen = new Set();
  const out = [];
  for (const value of Object.values(results ?? {})) {
    for (const row of Array.isArray(value) ? value : [value]) {
      if (!row || !row.string || seen.has(row.string)) continue;
      seen.add(row.string);
      out.push(row);
    }
  }
  return out;
};

const monthsOf = (row) => {
  const out = [];
  for (let i = 1; i <= 48; i += 1) {
    const v = row["m" + i];
    if (v !== null && v !== undefined) out.push({ volume: v, month: row["m" + i + "_month"], year: row["m" + i + "_year"] });
  }
  return out;
};

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const show = (v) => (v === null || v === undefined ? "null" : String(v));

function statusOf(r) {
  if (r.http === null) return "เน็ตพัง: " + r.raw;
  if (r.http !== 200) return "HTTP " + r.http + " · " + (r.json?.error?.message || r.raw || "");
  const err = r.json?.error;
  if (err && err.code && Number(err.code) !== 10) return "error " + err.code + " · " + (err.message || "");
  return null;
}

async function quota(label) {
  const r = await call("/quota");
  save(label, r.json);
  const q = r.json ?? {};
  const day = q.limits?.daily ?? {};
  return { left: day.remaining ?? null, used: day.used ?? null, quota: day.quota ?? null, limits: q.limits ?? null, raw: q, ms: r.ms };
}

const plan = QUOTA_ONLY
  ? [["อ่านโควตาคงเหลือ (ฟรี)", 0]]
  : [
      ["suggestions · type=suggestions · seed = " + SEED, 1],
      ["suggestions · type=questions · seed = " + SEED, 1],
      ["volume · 5 คำที่เคยวัดกับ DataForSEO แล้ว", 1],
    ];
const planned = plan.reduce((a, x) => a + x[1], 0);

console.log("\n  === วัด KeywordTool.io API ===\n");
console.log("  ปลายทาง    " + BASE + (SANDBOX ? "   <- sandbox ไม่กินโควตา" : ""));
console.log("  ตลาด       country=" + COUNTRY + " · language=" + LANGUAGE + " · metrics_location=" + LOCATION + "\n");
for (const p of plan) console.log("  · " + pad(p[0], 46) + lpad(p[1], 3) + " คำขอ");
console.log("  " + "-".repeat(60));
console.log("  รวม " + planned + " คำขอ จากโควตา 100/วัน ของแผน Growth\n");

if (DRY) { console.log("  --dry ยังไม่ยิงจริง จบแค่นี้\n"); process.exit(0); }

const before = await quota("00-quota-before");
console.log("  โควตาก่อนเริ่ม " + show(before.left) + "/" + show(before.quota) + " ต่อวัน  (ตอบใน " + before.ms + " ms)");
if (before.limits) for (const k of ["minute", "daily", "monthly"]) {
  const l = before.limits[k]; if (l) console.log("    " + pad(k, 8) + " เพดาน " + lpad(l.quota, 5) + " · ใช้ไป " + lpad(l.used, 4) + " · เหลือ " + l.remaining);
}
console.log("  response ดิบ: " + JSON.stringify(before.raw).slice(0, 200));
console.log("");

if (QUOTA_ONLY) {
  console.log("  --quota จบแค่นี้ ไม่ได้ใช้โควตาเลย\n");
  process.exit(0);
}

const results = {};

console.log("  -- 1. suggestions · type=suggestions " + "-".repeat(24));
const s1 = await call("/search/suggestions/google", {
  keyword: SEED,
  country: COUNTRY,
  language: LANGUAGE,
  metrics: true,
  metrics_location: [LOCATION],
  metrics_language: [LANGUAGE],
  complete: true,
});
save("01-suggestions", s1.json);
results.suggestions = s1;
const e1 = statusOf(s1);
if (e1) console.log("  x " + e1);
else {
  const items = flatten(s1.json?.results);
  console.log("  ตอบใน " + s1.ms + " ms · ได้ " + items.length + " คำ");
  if (items[0]) {
    console.log("  field ที่ได้: " + Object.keys(items[0]).join(" · "));
    console.log("  เดือนย้อนหลังที่มีค่าจริง: " + monthsOf(items[0]).length + " เดือน");
    console.log("  ห้าคำแรก: " + items.slice(0, 5).map((x) => x.string + "(" + show(x.volume) + ")").join(" · "));
    const nulls = items.filter((x) => x.volume === null || x.volume === undefined).length;
    console.log("  volume ที่เป็น null/ไม่มีค่า: " + nulls + " จาก " + items.length);
  }
  console.log("  device_breakdown: " + (s1.json?.device_breakdown ? JSON.stringify(s1.json.device_breakdown) : "ไม่มีในคำขอนี้"));
}
console.log("");

console.log("  -- 2. suggestions · type=questions " + "-".repeat(26));
const s2 = await call("/search/suggestions/google", {
  keyword: SEED,
  country: COUNTRY,
  language: LANGUAGE,
  type: "questions",
  metrics: true,
  metrics_location: [LOCATION],
  metrics_language: [LANGUAGE],
});
save("02-questions", s2.json);
results.questions = s2;
const e2 = statusOf(s2);
if (e2) console.log("  x " + e2);
else {
  const items = flatten(s2.json?.results);
  console.log("  ตอบใน " + s2.ms + " ms · ได้ " + items.length + " คำ");
  console.log("  ห้าคำแรก: " + items.slice(0, 5).map((x) => x.string + "(" + show(x.volume) + ")").join(" · "));
  console.log("  <- แท็บคำถามของเราได้ 0-3 คำจาก Google Ads เทียบตรงนี้ได้เลย");
}
console.log("");

console.log("  -- 3. volume · ส่งหลายคำในคำขอเดียว " + "-".repeat(23));
const SAME_AS_DFS = ["hotel", "โรงแรม เชียงใหม่", "ufa191", "7-11 game", "zxqwvbnmqplkkkzz"];
const s3 = await call("/search/volume/google", {
  keyword: SAME_AS_DFS,
  metrics_location: [LOCATION],
  metrics_language: [LANGUAGE],
});
save("03-volume", s3.json);
results.volume = s3;
const e3 = statusOf(s3);
if (e3) console.log("  x " + e3);
else {
  const items = flatten(s3.json?.results);
  console.log("  ตอบใน " + s3.ms + " ms · ส่งไป " + SAME_AS_DFS.length + " คำ ได้กลับ " + items.length + " คำ");
  console.log("");
  console.log("  " + pad("คำ", 22) + lpad("volume", 10) + lpad("cpc", 8) + lpad("cmp", 8) + lpad("trend", 9));
  for (const x of items) {
    console.log("  " + pad(x.string, 22) + lpad(show(x.volume), 10) + lpad(show(x.cpc), 8) +
      lpad(show(x.cmp), 8) + lpad(show(x.trend), 9));
  }
  const missing = SAME_AS_DFS.filter((k) => !items.some((x) => String(x.string).toLowerCase() === k.toLowerCase()));
  if (missing.length) console.log("\n  หายไปเงียบๆ: " + missing.join(" · "));
  console.log("\n  device_breakdown: " + (s3.json?.device_breakdown ? JSON.stringify(s3.json.device_breakdown) : "ไม่มี"));
}
console.log("");

const after = await quota("99-quota-after");
const used = (before.left !== null && after.left !== null) ? before.left - after.left : null;

console.log("  === สรุป ===\n");
console.log("  โควตาก่อน " + show(before.left) + " -> หลัง " + show(after.left));
console.log("  ใช้ไป " + show(used) + " หน่วย จาก " + planned + " คำขอที่ยิง");
if (used !== null) {
  console.log("  " + (used === planned
    ? "  <- 1 คำขอ = 1 หน่วย ไม่ว่าจะส่งกี่คำ (ส่ง 5 คำในข้อ 3 ก็ยังนับ 1)"
    : "  <- นับไม่ตรงกับจำนวนคำขอ ต้องดูสูตรการนับใหม่"));
}
console.log("\n  response ดิบเก็บไว้ที่\n  " + OUTDIR);
for (const f of saved) console.log("    · " + f);
console.log("\n  เอาตัวเลขพวกนี้ใส่กลับเข้า PLAN.md พร้อมวันที่\n");
