import { memo } from "react";

const W = 68;
const H = 22;

// Tailwind อ่านชื่อคลาสจากซอร์สตรงๆ ตอน build · ต่อสตริงเอาเองจะถูกตัดทิ้ง
// จึงต้องเขียนชื่อคลาสเต็มไว้ในตารางนี้
const TONE = {
  bar: "stroke-bar",
  up: "stroke-up",
  down: "stroke-down",
  brand: "stroke-brand",
};

function MiniTrend({ months, tone = "bar" }) {
  const points = (months || []).filter((m) => m.volume !== null && m.volume !== undefined);
  if (points.length < 2) return <span className="text-faint text-xs">—</span>;

  const max = Math.max(...points.map((p) => p.volume));
  const min = Math.min(...points.map((p) => p.volume));
  const span = max - min || 1;
  const step = W / (points.length - 1);

  const d = points
    .map((p, i) => (i ? "L" : "M") + (i * step).toFixed(1) + " " + (H - ((p.volume - min) / span) * (H - 3) - 1.5).toFixed(1))
    .join(" ");

  return (
    <svg width={W} height={H} viewBox={"0 0 " + W + " " + H} className="overflow-visible" aria-hidden="true">
      <path d={d} fill="none" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" className={TONE[tone] || TONE.bar} />
    </svg>
  );
}

export default memo(MiniTrend);
