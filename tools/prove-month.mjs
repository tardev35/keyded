// พิสูจน์ว่า KeywordTool ส่งเดือนไหนมาเป็นค่าอะไร โดยไม่ผ่านการตีความของเรา
//
// ที่มา — 6 ก.ย. 2569 หน้าเว็บ KeywordTool ขึ้น tooltip ว่า "Jul 2026 = 12,100"
// แต่ Keyded ขึ้น ก.ค. 69 = 9,900 · ต้องรู้ว่าใครถูก เพราะทีมใช้เดือนล่าสุด
// ตัดสินว่าแบรนด์ยังยิงแอดอยู่ไหม ถ้าอ่านผิดเดือนคือตัดสินใจผิด
//
// สคริปต์นี้รู้จัก API key ซึ่งขัดกฎ "ไฟล์เดียวที่รู้ความลับ" — ยอมได้เพราะเป็นเครื่องมือวัด
// ไม่ได้อยู่ในเส้นทางที่ผู้ใช้เรียกถึง และไม่เคยถูก import จาก backend
//
//   node tools/prove-month.mjs mz88
//   node tools/prove-month.mjs mz88 --raw     ดู JSON ดิบทั้งก้อนของคำนั้น

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const die = (m) => { console.error("\n  x " + m + "\n"); process.exit(1); };

function loadEnv() {
  let raw;
  try { raw = readFileSync(resolve(ROOT, ".env"), "utf8"); }
  catch { die("ไม่พบไฟล์ .env"); }
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
if (!env.KEYWORDTOOL_APIKEY) die("ยังไม่ได้ใส่ KEYWORDTOOL_APIKEY ใน .env");

const args = process.argv.slice(2);
const KEYWORD = args.find((a) => !a.startsWith("--")) || "mz88";
const RAW = args.includes("--raw");
const URL = "https://api.keywordtool.io/v2/search/volume/google";
const LOCATION = 2764;
const LANGUAGE = "th";

const TH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thai = (y, m) => TH[m] + " " + String((y + 543) % 100).padStart(2, "0");
const lpad = (s, n) => String(s).padStart(n);

console.log("\n  === พิสูจน์เดือนของ KeywordTool · คำว่า " + KEYWORD + " ===\n");
console.log("  POST " + URL);
console.log("  body { keyword: [\"" + KEYWORD + "\"], metrics_location: [" + LOCATION + "], metrics_language: [\"" + LANGUAGE + "\"] }");
console.log("  (apikey อ่านจาก .env ไม่พิมพ์ออกมา)\n");

const res = await fetch(URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    apikey: env.KEYWORDTOOL_APIKEY,
    keyword: [KEYWORD],
    metrics_location: [LOCATION],
    metrics_language: [LANGUAGE],
  }),
});

const json = await res.json();
if (res.status !== 200) die("HTTP " + res.status + " · " + JSON.stringify(json).slice(0, 300));

let row = null;
for (const value of Object.values(json?.results ?? {})) {
  for (const r of Array.isArray(value) ? value : [value]) if (r?.string) { row = r; break; }
  if (row) break;
}
if (!row) die("ไม่พบคำนี้ในผลลัพธ์");

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outdir = resolve(ROOT, "measurements", "prove-month-" + stamp);
mkdirSync(outdir, { recursive: true });
const file = resolve(outdir, KEYWORD + ".json");
writeFileSync(file, JSON.stringify(json, null, 2), "utf8");

if (RAW) {
  console.log("  --- JSON ดิบของแถวนี้ ---");
  console.log(JSON.stringify(row, null, 2));
  console.log("");
}

// ข้อ 1 — เลขเดือนนับจาก 0 หรือ 1 ตัดสินจากค่าที่โผล่จริง ไม่ใช่จากเอกสาร
const seen = new Set();
const pairs = [];
for (let i = 1; i <= 48; i += 1) {
  const mo = row["m" + i + "_month"];
  if (mo === null || mo === undefined) continue;
  seen.add(Number(mo));
  pairs.push({ i, month: Number(mo), year: Number(row["m" + i + "_year"]), volume: row["m" + i] });
}

console.log("  --- ข้อ 1 · เลขเดือนนับจาก 0 หรือ 1 ---");
console.log("  ค่าที่โผล่จริงทั้งหมด : " + [...seen].sort((a, b) => a - b).join(", "));
console.log("  มีเลข 0 ไหม          : " + (seen.has(0) ? "มี" : "ไม่มี"));
console.log("  มีเลข 12 ไหม         : " + (seen.has(12) ? "มี" : "ไม่มี"));
console.log("  สรุป                 : " + (seen.has(0) ? "นับจาก 0 (0 = มกราคม)" : "นับจาก 1 (1 = มกราคม) → เดือน 7 = กรกฎาคม"));
console.log("");

// ข้อ 2 — คีย์ดิบ 4 ตัวแรกที่ API ส่งมา · m1 คือเดือนใหม่สุด ไม่ใช่เก่าสุด
console.log("  --- ข้อ 2 · คีย์ดิบตามที่ API ส่งกลับมา ---");
for (const p of pairs.slice(0, 4)) {
  console.log(
    "  " + ("\"m" + p.i + "\"").padEnd(6) + ": " + lpad(p.volume, 7) +
    "   \"m" + p.i + "_year\": \"" + p.year + "\"" +
    "   \"m" + p.i + "_month\": \"" + p.month + "\"" +
    "   → " + thai(p.year, p.month)
  );
}
console.log("");

// ข้อ 3 — คำตอบตรงๆ ของเดือนที่กำลังเถียงกัน
const sorted = [...pairs].sort((a, b) => a.year - b.year || a.month - b.month);
const newest = sorted[sorted.length - 1];
console.log("  --- ข้อ 3 · หกเดือนล่าสุด เรียงจากเก่าไปใหม่ ---");
for (const p of sorted.slice(-6)) {
  const mark = p === newest ? "   <- เดือนใหม่สุดที่ KeywordTool มี" : "";
  console.log("  " + p.year + "-" + String(p.month).padStart(2, "0") + " (" + thai(p.year, p.month) + ") = " + lpad(p.volume, 7) + mark);
}
console.log("");
console.log("  volume (เฉลี่ย 12 เดือน) = " + row.volume + "   trend = " + row.trend + " (หน้าเว็บแสดงเป็น " + Math.round(row.trend * 100).toLocaleString() + "%)");
console.log("");
console.log("  response ดิบเก็บไว้ที่ " + file + "\n");
