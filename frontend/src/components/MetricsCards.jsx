import { fmtNumber, fmtTrend, competitionLabel, competitionTone, monthLabel } from "../lib/format.js";

// คำอธิบายย้ายไปเป็น title ของป้าย — ยังอ่านได้เมื่อเอาเมาส์ชี้ แต่ไม่มีไอคอนมากวนสายตา
function Card({ label, hint, children, foot }) {
  return (
    <div className="px-4 py-3 min-w-[9.5rem]">
      <div title={hint} className="text-xs font-medium text-muted whitespace-nowrap">
        {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums">{children}</div>
      {foot ? <div className="mt-0.5 text-[11px] leading-tight text-faint">{foot}</div> : null}
    </div>
  );
}

export default function MetricsCards({ summary, truncated, source, fetchedAtThai, ageDays }) {

  const trendUp = summary.trendPct !== null && summary.trendPct > 0;
  const trendDown = summary.trendPct !== null && summary.trendPct < 0;

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-start divide-x divide-line">
        <Card
          label="จำนวนคำ"
          hint="นับเฉพาะคำค้นที่ต่างกันจริง · Google Ads คืนคำเดียวกันหลายรูปได้เมื่อคำตั้งต้นมีเครื่องหมาย เช่น 7-11 game กับ 7 11 game ซึ่งเป็นคำค้นเดียวกัน"
          foot={
            summary.duplicateCount > 0
              ? "ไม่นับซ้ำอีก " + fmtNumber(summary.duplicateCount) + " คำที่เป็นคำเดียวกัน"
              : truncated
                ? "แสดง " + fmtNumber(truncated.shown) + " จาก " + fmtNumber(truncated.total)
                : null
          }
        >
          {fmtNumber(summary.totalKeywords)}
        </Card>

        <Card
          label="ปริมาณค้นหารวม"
          hint="ผลรวมของค่าเฉลี่ยต่อเดือน (คิดจาก 12 เดือนล่าสุดของแต่ละคำ) ไม่ใช่ยอดค้นหาเดือนนี้"
          foot={
            summary.volumeUnknown > 0
              ? "รวมจาก " + fmtNumber(summary.volumeCounted) + " คำ · ไม่มีข้อมูล " + fmtNumber(summary.volumeUnknown) + " คำ"
              : "รวมครบทั้ง " + fmtNumber(summary.volumeCounted) + " คำ"
          }
        >
          {fmtNumber(summary.totalVolume)}
        </Card>

        <Card
          label="แนวโน้ม"
          hint="เทียบเดือนล่าสุดกับเดือนแรกสุดของช่วง (สูตรเดียวกับ KeywordTool) · ดูแค่สองเดือนหัวท้าย ไม่สนใจเดือนตรงกลาง และ Google ปัดค่าเป็นช่วงอยู่แล้ว ตัวเลขนี้จึงกระโดดแรง ใช้ดูทิศทางเท่านั้น"
          foot={summary.trendMonths ? "เทียบเดือนล่าสุดกับเดือนแรกที่มีคนค้น · ห่างกัน " + summary.trendMonths + " เดือน" : null}
        >
          <span className={trendUp ? "text-up" : trendDown ? "text-down" : ""}>
            {trendUp ? "↑ " : trendDown ? "↓ " : ""}
            {fmtTrend(summary.trendPct)}
          </span>
        </Card>

        <Card
          label="การแข่งขันเฉลี่ย"
          hint="ค่าเฉลี่ยของ competition index (0–100) ที่ Google Ads ให้มา แล้วแปลงกลับเป็นระดับ"
          foot={
            summary.competitionUnknown > 0
              ? "จาก " + fmtNumber(summary.competitionCounted) + " คำ · ไม่มีข้อมูล " + fmtNumber(summary.competitionUnknown) + " คำ"
              : null
          }
        >
          <span className={competitionTone(summary.avgCompetition)}>
            {fmtNumber(summary.avgCompetitionIndex)}
            <span className="ml-1 text-sm font-medium">({competitionLabel(summary.avgCompetition)})</span>
          </span>
        </Card>

        <Card
          label="ช่วงข้อมูล"
          hint="ตัวเลขของ Google Ads อัปเดตเดือนละครั้งและช้ากว่าปัจจุบันประมาณสองเดือน · ระบบจะดึงใหม่ทันทีที่ Google ออกข้อมูลเดือนถัดไป ไม่ต้องรอครบอายุแคช"
          foot={
            source === "cache"
              ? "ครอบคลุมถึง " + monthLabel(summary.monthsTo) + " · ดึงเมื่อ " + fetchedAtThai
              : "เพิ่งดึงสด · " + fetchedAtThai
          }
        >
          <span className="text-base">
            {monthLabel(summary.monthsFrom)} – {monthLabel(summary.monthsTo)}
          </span>
        </Card>
      </div>
    </div>
  );
}
