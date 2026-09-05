import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

config({ path: resolve(ROOT, ".env") });

const REQUIRED = [
  "DATAFORSEO_LOGIN",
  "DATAFORSEO_PASSWORD",
  "DATABASE_URL",
  "JWT_SECRET",
];

const missing = REQUIRED.filter((k) => !String(process.env[k] || "").trim());
if (missing.length) {
  console.error("");
  console.error("  x เริ่มระบบไม่ได้ ขาดค่าใน .env: " + missing.join(", "));
  console.error("    ไฟล์ที่อ่าน: " + resolve(ROOT, ".env"));
  console.error("");
  process.exit(1);
}

const num = (k, d) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) ? v : d;
};

export const env = {
  ROOT,
  PORT: num("PORT", 4000),
  DATABASE_URL: process.env.DATABASE_URL,

  DATAFORSEO_LOGIN: process.env.DATAFORSEO_LOGIN,
  DATAFORSEO_PASSWORD: process.env.DATAFORSEO_PASSWORD,
  DATAFORSEO_BASE_URL: process.env.DATAFORSEO_BASE_URL || "https://api.dataforseo.com/v3",

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
  REFRESH_EXPIRES_IN: process.env.REFRESH_EXPIRES_IN || "7d",

  CACHE_DAYS: num("KEYFIN_CACHE_DAYS", 30),
  QUOTA_FREE_PER_DAY: num("QUOTA_FREE_PER_DAY", 5),
  QUOTA_PAID_PER_DAY: num("QUOTA_PAID_PER_DAY", 200),
  TZ: process.env.KEYFIN_TZ || "Asia/Bangkok",

  MONTHS_BACK: num("KEYFIN_MONTHS_BACK", 24),
  RATE_PER_MINUTE: num("KEYFIN_RATE_PER_MINUTE", 10),
  FREE_ROW_LIMIT: num("KEYFIN_FREE_ROW_LIMIT", 50),
  USD_THB: num("KEYFIN_USD_THB", 33),
  BULK_MAX: num("KEYFIN_BULK_MAX", 2100),
  BULK_CHUNK: num("KEYFIN_BULK_CHUNK", 700),
};
