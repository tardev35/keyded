import { fmtNumber, fmtTrend, monthLabel } from "../lib/format.js";

const W = 300;
const H = 120;
const PAD_L = 6;
const PAD_B = 18;

// วาดด้วย SVG ตรงๆ ไม่เรียก Recharts ต่อหนึ่งแถว เพราะป๊อปอัปนี้เกิดทุกครั้งที่เมาส์ผ่าน
// ตารางหลายร้อยแถว การสร้าง chart instance ใหม่ทุกครั้งจะกระตุกทันที
export default function TrendPopover({ row, anchor }) {
  if (!row || !anchor) return null;
  const months = (row.months || []).filter((m) => m.volume !== null && m.volume !== undefined);
  if (months.length < 2) return null;

  const max = Math.max(...months.map((m) => m.volume)) || 1;
  const slot = (W - PAD_L * 2) / months.length;
  const barW = Math.max(3, slot * 0.68);

  const up = row.trendPct !== null && row.trendPct > 0;
  const down = row.trendPct !== null && row.trendPct < 0;

  const width = W + 24;
  const height = H + 66;
  const left = Math.min(Math.max(12, anchor.x - width / 2), window.innerWidth - width - 12);
  const top = anchor.y - height - 10 < 12 ? anchor.y + 26 : anchor.y - height - 10;

  return (
    <div
      style={{ position: "fixed", left, top, width }}
      className="pointer-events-none z-50 rounded-xl border border-line bg-surface p-3 shadow-2xl"
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium">{row.keyword}</span>
        <span className={"shrink-0 text-xs font-semibold " + (up ? "text-up" : down ? "text-down" : "text-muted")}>
          {up ? "↑ " : down ? "↓ " : ""}
          {fmtTrend(row.trendPct)}
        </span>
      </div>
      <div className="mb-1.5 text-[10px] text-faint">
        ค้นหาเฉลี่ย {fmtNumber(row.volume)} ต่อเดือน · สูงสุดในกราฟ {fmtNumber(max)}
      </div>

      <svg width={W} height={H} className="overflow-visible text-bar">
        <line x1="0" y1={H - PAD_B} x2={W} y2={H - PAD_B} className="stroke-line" strokeWidth="1" />
        {months.map((m, i) => {
          const h = Math.max(1, ((H - PAD_B - 4) * m.volume) / max);
          return (
            <g key={m.year + "-" + m.month}>
              <rect
                x={PAD_L + i * slot + (slot - barW) / 2}
                y={H - PAD_B - h}
                width={barW}
                height={h}
                rx="1.5"
                fill="currentColor"
              />
              {i === 0 || i === months.length - 1 || i === Math.floor(months.length / 2) ? (
                <text
                  x={PAD_L + i * slot + slot / 2}
                  y={H - 5}
                  textAnchor="middle"
                  className="fill-faint"
                  style={{ fontSize: 9 }}
                >
                  {monthLabel(m)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
