import { memo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCompact, fmtNumber, fmtTrend, monthLabel } from "../lib/format.js";

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="text-muted">{monthLabel(row)}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{fmtNumber(row.volume)}</div>
    </div>
  );
}

// Recharts เลือกป้ายแกนเองโดยไล่จากแท่งแรก แล้วค่อยบังคับแท่งสุดท้ายเพิ่มทีหลัง
// พอจำนวนแท่งเป็นเลขคู่ ป้ายสองเดือนก่อนแท่งสุดท้ายจึงหายไปทั้งคู่
// (เจอ 24 ก.ย. 2569 — somtum168 26 แท่ง แกนข้ามจาก พ.ค. 69 ไป ส.ค. 69 เลย)
// เดือนล่าสุดคือเดือนที่ทีมอ่านบ่อยที่สุด ป้ายแถวนั้นหายไม่ได้
// จึงเลือกป้ายเองโดยนับถอยหลังจากแท่งสุดท้าย ระยะห่างเท่ากันทุกช่วงและจบที่เดือนล่าสุดเสมอ
const axisTicks = (data) => {
  const step = Math.max(1, Math.ceil(data.length / 13));
  const out = [];
  for (let i = data.length - 1; i >= 0; i -= step) out.unshift(data[i].label);
  return out;
};

function TrendChart({ chart, trendPct, trendMonths, title, onClear }) {
  const data = (chart || []).map((m) => ({ ...m, label: monthLabel(m) }));
  if (data.length < 2) {
    return (
      <div className="grid h-56 place-items-center gap-2 rounded-xl border border-line bg-surface text-sm text-faint">
        <span>ไม่มีข้อมูลรายเดือนสำหรับ{title ? " " + title : "คำนี้"}</span>
        {onClear ? (
          <button type="button" onClick={onClear} className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-muted hover:text-ink">ดูรวมทุกคำ</button>
        ) : null}
      </div>
    );
  }

  const up = trendPct !== null && trendPct > 0;
  const down = trendPct !== null && trendPct < 0;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className={onClear ? "font-semibold text-ink" : ""}>{title}</span>
          {onClear ? (
            <button type="button" onClick={onClear} className="rounded-lg border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink">ดูรวมทุกคำ</button>
          ) : null}
        </div>
        <div className="text-sm">
          <span className={up ? "text-up font-semibold" : down ? "text-down font-semibold" : "text-muted"}>
            {up ? "↑ " : down ? "↓ " : ""}
            {fmtTrend(trendPct)}
          </span>
          <span className="ml-1.5 text-xs text-faint">เทียบกับเดือนแรกที่มีคนค้น ห่างกัน {trendMonths} เดือน</span>
        </div>
      </div>

      <div className="h-56 text-bar">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} strokeOpacity={0.18} stroke="currentColor" className="text-faint" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              ticks={axisTicks(data)}
              interval="preserveStartEnd"
              minTickGap={18}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-faint"
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtCompact}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-faint"
            />
            <Tooltip cursor={{ fillOpacity: 0.08 }} content={<ChartTooltip />} />
            <Bar dataKey="volume" fill="currentColor" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(TrendChart);
