const num = (v) => (v === null || v === undefined ? null : Number(v));

// null คือ "ไม่รู้" · 0 คือ "ไม่มีใครค้น" · ห้ามยุบเข้าหากันทุกกรณี (PLAN ข้อ 2.2)
// ทุกฟังก์ชันในไฟล์นี้ต้องรักษาความต่างนี้ไว้จนถึงหน้าเว็บ
const known = (v) => v !== null && v !== undefined;

const COMPETITION_FROM_INDEX = (index) => {
  if (!known(index)) return null;
  if (index <= 33) return "LOW";
  if (index <= 66) return "MEDIUM";
  return "HIGH";
};

function monthsAscending(monthly) {
  if (!Array.isArray(monthly) || monthly.length === 0) return null;
  return monthly
    .map((m) => ({ year: Number(m.year), month: Number(m.month), volume: num(m.search_volume) }))
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

// สูตรเดียวกับ KeywordTool — (เดือนล่าสุด - เดือนแรกที่ไม่เป็นศูนย์) / เดือนแรกที่ไม่เป็นศูนย์
//
// ฐานคือเดือนแรกที่ "มีคนค้นจริง" ไม่ใช่เดือนแรกของหน้าต่าง · เดิมเราใช้เดือนแรกสุด
// ซึ่งแบรนด์ใหม่จะเป็น 0 แล้วหารศูนย์ไม่ได้ ทุกคำแบรนด์จึงขึ้น "—" ทั้งที่โตขึ้นจริง
// ซึ่งเป็นคำที่ทีมสนใจที่สุด (แก้ 7 ก.ย. 2569)
//
// ยืนยันกับ API ของ KeywordTool แล้วสามคำ — spy1688 (720-110)/110 = +555%
// rumruay999 (390-20)/20 = +1,850% · mz88 = +98,900% ตรงกันทั้งสามคำ
//
// ผลข้างเคียงที่ต้องรู้ — สูตรนี้ดูแค่สองเดือนหัวท้าย ไม่สนใจเดือนตรงกลาง
// พอ Google ปัดค่าเป็นช่วงด้วย ตัวเลขจึงกระโดดแรง · ห้ามเอาไปเรียงลำดับเป็นหลัก
function trendOf(months) {
  const usable = (months || []).filter((m) => known(m.volume));
  if (usable.length < 2) return { trendPct: null, trendMonths: usable.length };

  const from = usable.findIndex((m) => m.volume > 0);

  // ไม่เคยมีเดือนไหนมีคนค้นเลย หรือเพิ่งมีเดือนเดียวคือเดือนล่าสุด — คำนวณการเติบโตไม่ได้
  // เดือนเดียวคืนเป็น 0% จะอ่านว่า "ทรงตัว" ซึ่งตรงข้ามกับความจริงที่มันเพิ่งพุ่งขึ้นจากศูนย์
  if (from === -1 || from === usable.length - 1) return { trendPct: null, trendMonths: usable.length };

  const base = usable[from].volume;
  const newest = usable[usable.length - 1].volume;
  return {
    trendPct: Math.round(((newest - base) / base) * 100),
    trendMonths: usable.length - from,
  };
}

function brandOf(annotations) {
  const concepts = annotations?.concepts;
  if (!Array.isArray(concepts)) return null;
  for (const c of concepts) {
    const type = c?.concept_group?.type;
    if (type === "BRAND" || type === "NON_BRAND") return type;
  }
  return null;
}

export function normalizeRow(raw) {
  const months = monthsAscending(raw.monthly_searches);
  const { trendPct, trendMonths } = trendOf(months);
  const competitionIndex = num(raw.competition_index);
  return {
    keyword: String(raw.keyword),
    volume: num(raw.search_volume),
    competition: raw.competition ?? COMPETITION_FROM_INDEX(competitionIndex),
    competitionIndex,
    cpc: num(raw.cpc),
    lowBid: num(raw.low_top_of_page_bid),
    highBid: num(raw.high_top_of_page_bid),
    months,
    trendPct,
    trendMonths,
    brand: brandOf(raw.keyword_annotations),
  };
}

// เดือนล่าสุดที่ข้อมูลชุดนี้ครอบคลุม · ใช้ตัดสินว่าแคชเก่าไปแล้วหรือยัง
// ตัดสินจาก "เนื้อข้อมูล" ไม่ใช่จาก "วันที่เราดึง" เพราะสองอย่างนี้ไม่ได้ขยับพร้อมกัน
export function latestMonthOf(rows) {
  let best = null;
  for (const row of rows || []) {
    const last = row.months?.[row.months.length - 1];
    if (!last) continue;
    const value = last.year * 12 + last.month;
    if (!best || value > best.value) best = { value, year: last.year, month: last.month };
  }
  if (!best) return null;
  return best.year + "-" + String(best.month).padStart(2, "0") + "-01";
}

// ค่าที่คำนวณได้จาก months ต้องคิดใหม่ตอนอ่าน ไม่ใช่เชื่อค่าที่ค้างในแคช
// วันที่เปลี่ยนสูตรเทรนด์ (5 ก.ย. 2569) ของเก่าในแคชยังถือเลขสูตรเดิมอยู่
// ถ้าไม่คิดใหม่ ตารางกับยอดสรุปจะใช้คนละสูตรกันโดยไม่มีใครสังเกต
// คำถามจริงที่ผู้ใช้ถามเครื่องมือนี้คือ "แบรนด์นี้ยังทำการตลาดอยู่ไหม"
// ซึ่งดูจากเดือนท้ายๆ ไม่ใช่ค่าเฉลี่ยทั้งปี · ค่าเฉลี่ยยังสูงอยู่ได้ทั้งที่เงียบมาสามเดือนแล้ว
// ทั้งสองค่านี้เป็นข้อเท็จจริงจากข้อมูลตรงๆ ไม่ใช่การตีความหรือให้คะแนน
function activityOf(months) {
  const known3 = (months || []).filter((m) => known(m.volume)).slice(-3);
  if (!known3.length) return { latest: null, silentMonths: 0 };
  let silent = 0;
  for (let i = known3.length - 1; i >= 0; i -= 1) {
    if (known3[i].volume === 0) silent += 1;
    else break;
  }
  return { latest: known3[known3.length - 1], silentMonths: silent };
}

export function withFreshTrend(rows) {
  return rows.map((row) => ({ ...row, ...trendOf(row.months), ...activityOf(row.months) }));
}

export function normalizeRows(rawRows) {
  return rawRows
    .map(normalizeRow)
    .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
}

// Labs ห่อตัวเลขไว้ใน keyword_info และให้ competition เป็นทศนิยม 0–1
// ส่วน Google Ads ให้ competition_index เป็น 0–100 · ต้องแปลงให้เป็นสเกลเดียวกัน
// ไม่งั้นการเรียงลำดับกับการหาค่าเฉลี่ยจะเทียบข้ามหน่วยโดยไม่มีใครสังเกต
export function normalizeLabsRow(raw) {
  const info = raw.keyword_info ?? {};
  const months = monthsAscending(info.monthly_searches);
  const { trendPct, trendMonths } = trendOf(months);
  const competition = num(info.competition);
  return {
    keyword: String(raw.keyword),
    volume: num(info.search_volume),
    competition: info.competition_level ?? null,
    competitionIndex: known(competition) ? Math.round(competition * 100) : null,
    cpc: num(info.cpc),
    lowBid: num(info.low_top_of_page_bid),
    highBid: num(info.high_top_of_page_bid),
    months,
    trendPct,
    trendMonths,
    brand: null,
  };
}

export function normalizeLabsRows(items) {
  return items
    .map(normalizeLabsRow)
    .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
}

// Google Ads คืนคำเดียวกันหลายรูปเมื่อคำตั้งต้นมีเครื่องหมาย — วัดจริง 4 ก.ย. 2569
// seed "7-11 game" ได้ทั้ง "7-11 game" และ "7 11 game" ปริมาณ 2,900 เท่ากันทั้งคู่
// เพราะเป็นคำค้นเดียวกัน · เอามาบวกกันจะได้ยอดรวมเป็นสองเท่าโดยดูไม่ออก
// ไม่ลบแถวทิ้ง แค่ทำเครื่องหมายไว้ แล้วไม่นับซ้ำตอนรวมยอด (CLAUDE.md กฎข้อ 4)
const sameQueryKey = (keyword) =>
  keyword.toLowerCase().replace(/[-_.'"]/g, " ").replace(/\s+/g, " ").trim();

// ภาษาไทยเว้นวรรคยังไงก็ได้ Labs จึงคืน "เข้าสู่ระบบufa191" กับ "เข้า สู่ ระบบ ufa191"
// เป็นคนละแถวทั้งที่เป็นคำค้นเดียวกัน (วัดจริง 5 ก.ย. 2569 พองยอดรวมไป 75%)
// ต้องลบช่องว่างทั้งหมดก่อนเทียบ ไม่ใช่แค่ยุบให้เหลือช่องเดียว
const tightKey = (keyword) => keyword.toLowerCase().replace(/[-_.'"\s]/g, "");

// เทียบว่าคำนั้น "มีคำตั้งต้นอยู่ในนั้นไหม" ต้องเทียบหลังตัดเครื่องหมายเหมือนกัน
// ไม่งั้น seed "7-11 game" จะมองว่า "7 11 game" เป็นคนละเรื่องกัน ทั้งที่เป็นคำค้นเดียวกัน
export function markDuplicates(rows, seed = "") {
  const canonical = new Map();
  const seedKey = sameQueryKey(seed);
  return rows.map((row) => {
    const containsSeed = Boolean(seedKey) && sameQueryKey(row.keyword).includes(seedKey);
    const key = tightKey(row.keyword);
    const first = canonical.get(key);

    // ลบช่องว่างอย่างเดียวไม่พอ — "ufa19 1" (70 ครั้ง) กับ "ufa191" (135,000 ครั้ง)
    // จะกลายเป็นคำเดียวกันทั้งที่คนละคำจริงๆ · ถือว่าซ้ำต่อเมื่อปริมาณค้นหาเท่ากันด้วย
    if (first && first.volume === row.volume) {
      return { ...row, duplicateOf: first.keyword, containsSeed };
    }
    if (!first) canonical.set(key, { keyword: row.keyword, volume: row.volume });
    return { ...row, duplicateOf: null, containsSeed };
  });
}

export function summarize(allRows) {
  const rows = allRows.filter((r) => !r.duplicateOf);
  const duplicateCount = allRows.length - rows.length;
  const withVolume = rows.filter((r) => known(r.volume));
  const withCompetition = rows.filter((r) => known(r.competitionIndex));

  const byMonth = new Map();
  for (const row of rows) {
    if (!row.months) continue;
    for (const m of row.months) {
      if (!known(m.volume)) continue;
      const key = m.year + "-" + String(m.month).padStart(2, "0");
      const prev = byMonth.get(key) || { year: m.year, month: m.month, volume: 0 };
      prev.volume += m.volume;
      byMonth.set(key, prev);
    }
  }
  const chart = [...byMonth.values()].sort((a, b) => a.year - b.year || a.month - b.month);
  const { trendPct, trendMonths } = trendOf(chart);

  const avgIndex = withCompetition.length
    ? Math.round(withCompetition.reduce((a, r) => a + r.competitionIndex, 0) / withCompetition.length)
    : null;

  return {
    totalKeywords: rows.length,
    totalRows: allRows.length,
    duplicateCount,
    // ไม่มีคำไหนรู้ปริมาณเลย = "ไม่รู้" ต้องเป็น null ให้หน้าจอขึ้น —
    // ถ้าคืน 0 จะกลายเป็น "ไม่มีใครค้นเลย" ซึ่งคนละความหมาย (CLAUDE.md กฎข้อ 1)
    totalVolume: withVolume.length ? withVolume.reduce((a, r) => a + r.volume, 0) : null,
    volumeCounted: withVolume.length,
    volumeUnknown: rows.length - withVolume.length,
    avgCompetitionIndex: avgIndex,
    avgCompetition: COMPETITION_FROM_INDEX(avgIndex),
    competitionCounted: withCompetition.length,
    competitionUnknown: rows.length - withCompetition.length,
    trendPct,
    trendMonths,
    chart,
    monthsFrom: chart[0] ?? null,
    monthsTo: chart[chart.length - 1] ?? null,
  };
}

const QUESTION_WORDS = [
  "ทำไม", "อะไร", "ยังไง", "อย่างไร", "ที่ไหน", "เมื่อไหร่", "เมื่อไร", "ใคร", "กี่", "เท่าไหร่", "เท่าไร", "ไหม", "มั้ย",
  "how", "what", "why", "where", "when", "who", "which", "is", "are", "can", "does", "do", "should",
];

const PREPOSITIONS = [
  "ใน", "กับ", "สำหรับ", "ของ", "ใกล้", "ที่", "จาก", "ถึง", "แบบ", "ราคา",
  "for", "with", "without", "near", "to", "in", "at", "on", "by", "from", "vs", "versus", "like",
];

const hasWord = (keyword, list) => {
  const text = " " + keyword.toLowerCase().replace(/\s+/g, " ") + " ";
  return list.some((w) => text.includes(" " + w + " ") || text.startsWith(" " + w));
};

export function classify(keyword) {
  return {
    question: hasWord(keyword, QUESTION_WORDS),
    preposition: hasWord(keyword, PREPOSITIONS),
  };
}

export function withTabs(rows) {
  return rows.map((r) => ({ ...r, tabs: classify(r.keyword) }));
}
