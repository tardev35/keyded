const nf = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });

// Google ปัดตัวเลขเป็นช่วงมาก่อนแล้ว ทศนิยมจึงเป็นความแม่นยำปลอม (PLAN ข้อ 2.6)
export const fmtNumber = (v) => (v === null || v === undefined ? "—" : nf.format(Math.round(v)));

export const fmtCompact = (v) => {
  if (v === null || v === undefined) return "—";
  if (v >= 1000000) return nf.format(Math.round(v / 100000) / 10) + "M";
  if (v >= 1000) return nf.format(Math.round(v / 100) / 10) + "K";
  return nf.format(v);
};

export const fmtTrend = (p) => (p === null || p === undefined ? "—" : (p > 0 ? "+" : "") + nf.format(p) + "%");

// ตารางแปลของเราเอง · คำที่ยังไม่รู้จักให้แสดงต้นฉบับ ไม่เดาคำแปล
const COMPETITION_TH = { LOW: "ต่ำ", MEDIUM: "ปานกลาง", HIGH: "สูง" };
export const competitionLabel = (code) => (code ? COMPETITION_TH[code] || code : "—");

export const competitionTone = (code) =>
  code === "HIGH" ? "text-down" : code === "MEDIUM" ? "text-bar" : code === "LOW" ? "text-up" : "text-faint";

const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const monthLabel = (m) => (m ? MONTH_TH[m.month - 1] + " " + String((m.year + 543) % 100).padStart(2, "0") : "");

export const brandLabel = (code) =>
  code === "BRAND" ? "มียี่ห้อ" : code === "NON_BRAND" ? "ไม่มียี่ห้อ" : null;
