import { env } from "../config/env.js";

const partsIn = (date, tz) => {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out = {};
  for (const p of f.formatToParts(date)) if (p.type !== "literal") out[p.type] = p.value;
  if (out.hour === "24") out.hour = "00";
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
  };
};

const pad = (n) => String(n).padStart(2, "0");

export function dayKey(date = new Date(), tz = env.TZ) {
  const p = partsIn(date, tz);
  return p.year + "-" + pad(p.month) + "-" + pad(p.day);
}

export function offsetMs(date, tz) {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// เก็บ timestamp ใน DB เป็น UTC ตามปกติ แต่จุดตัดวันต้องเป็นเที่ยงคืนไทย
// ไม่งั้นโควตาจะไปรีเซ็ตตอน 07:00 น. ของไทย (PLAN ข้อ 5)
export function nextResetAt(date = new Date(), tz = env.TZ) {
  const p = partsIn(date, tz);
  const midnightAsUtc = Date.UTC(p.year, p.month - 1, p.day + 1, 0, 0, 0);
  return new Date(midnightAsUtc - offsetMs(date, tz));
}

export function isNewDay(resetAt, date = new Date()) {
  if (!resetAt) return true;
  return date.getTime() >= new Date(resetAt).getTime();
}

// ตัวเลขของ Google ช้ากว่าปัจจุบันประมาณสองเดือน (วัดจริง 4 ก.ย. 2569 เดือนล่าสุดคือ 2026-07)
// ขอเผื่อไปสองเดือนเสมอ ไม่งั้นจะได้กราฟสั้นกว่าที่ผู้ใช้เห็นบนป้าย
export function dateFromForMonths(months, date = new Date(), tz = env.TZ) {
  const p = partsIn(date, tz);
  const back = months + 2;
  const d = new Date(Date.UTC(p.year, p.month - 1 - back, 1));
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-01";
}

export function thaiDate(value) {
  if (!value) return null;
  const p = partsIn(new Date(value), env.TZ);
  return p.day + "/" + pad(p.month) + "/" + (p.year + 543);
}
