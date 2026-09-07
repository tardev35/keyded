import { useEffect, useMemo, useRef, useState } from "react";
import MiniTrend from "./MiniTrend.jsx";
import TrendPopover from "./TrendPopover.jsx";
import { brandLabel, competitionLabel, competitionTone, fmtNumber, fmtTrend, monthLabel } from "../lib/format.js";

const ROW_H = 44;
const VIEWPORT_H = 528;
const OVERSCAN = 8;
const GRID = "grid grid-cols-[2.25rem_minmax(10rem,1fr)_7.5rem_6rem_5rem_7rem] items-center gap-2 px-3";

const SORTS = {
  volume: (a, b) => (b.volume ?? -1) - (a.volume ?? -1),
  keyword: (a, b) => a.keyword.localeCompare(b.keyword, "th"),
  trend: (a, b) => (b.trendPct ?? -Infinity) - (a.trendPct ?? -Infinity),
  // เรียงด้วย index ที่เป็นตัวเลข ไม่ใช่ข้อความ — เรียงข้อความจะได้ HIGH < LOW < MEDIUM
  // ซึ่งไม่มีความหมาย (PLAN ข้อ 2.6)
  competition: (a, b) => (b.competitionIndex ?? -1) - (a.competitionIndex ?? -1),
};

// ทั้งหมดมาจากผลชุดเดียวกันที่ยิงครั้งเดียว จึงเป็น "ตัวกรอง" ไม่ใช่ "แท็บ"
// แยกเป็นแท็บจะทำให้เข้าใจผิดว่าแต่ละอันมาจากการค้นคนละครั้ง
const GROUPS = [
  { id: "all", label: "ทั้งหมด", test: () => true },
  { id: "seed", label: "มีคำตั้งต้น", test: (r) => Boolean(r.containsSeed) },
  { id: "question", label: "คำถาม", test: (r) => Boolean(r.tabs?.question) },
  { id: "preposition", label: "คำเชื่อม", test: (r) => Boolean(r.tabs?.preposition) },
];

const anchorOf = (event) => {
  const box = event.currentTarget.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top };
};

function SortButton({ id, sort, setSort, children, className = "" }) {
  const active = sort.key === id;
  return (
    <button
      type="button"
      onClick={() => setSort({ key: id, desc: active ? !sort.desc : true })}
      className={"flex items-center gap-1 text-xs font-medium transition-colors " + (active ? "text-ink" : "text-muted hover:text-ink") + " " + className}
    >
      {children}
      <span className={"text-[9px] " + (active ? "opacity-100" : "opacity-0")}>{sort.desc ? "▼" : "▲"}</span>
    </button>
  );
}

export default function KeywordTable({ rows, truncated, focused, onFocus, onRetrySingle }) {
  const [rawFilter, setRawFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState({ key: "volume", desc: true });
  const [selected, setSelected] = useState(() => new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [hover, setHover] = useState(null);
  const [group, setGroup] = useState("all");
  const scroller = useRef(null);

  // หน่วง 150 ms ให้พิมพ์จบก่อนค่อยกรอง ไม่งั้นทุกตัวอักษรจะสั่งวาดตารางใหม่ทั้งก้อน
  useEffect(() => {
    const timer = setTimeout(() => setFilter(rawFilter.trim().toLowerCase()), 150);
    return () => clearTimeout(timer);
  }, [rawFilter]);

  const counts = useMemo(
    () => GROUPS.map((g) => ({ ...g, count: rows.filter(g.test).length })).filter((g) => g.id === "all" || g.count > 0),
    [rows]
  );

  const visible = useMemo(() => {
    const test = GROUPS.find((g) => g.id === group)?.test ?? GROUPS[0].test;
    let list = rows.filter(test);
    if (filter) list = list.filter((r) => r.keyword.toLowerCase().includes(filter));
    const cmp = SORTS[sort.key] || SORTS.volume;
    list.sort(cmp);
    if (!sort.desc) list.reverse();
    return list;
  }, [rows, filter, sort, group]);

  useEffect(() => {
    setScrollTop(0);
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [filter, sort, rows, group]);

  // ตารางหลายร้อยแถวถ้าวาดทั้งหมด ทุกครั้งที่พิมพ์หรือกดเรียงเบราว์เซอร์จะสร้าง DOM ใหม่ทั้งก้อน
  // แล้วกระตุก · วาดเฉพาะแถวที่อยู่ในจอบวกกันชนไว้เล็กน้อย
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(visible.length, Math.ceil((scrollTop + VIEWPORT_H) / ROW_H) + OVERSCAN);
  const slice = visible.slice(start, end);

  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.keyword));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) visible.forEach((r) => next.delete(r.keyword));
      else visible.forEach((r) => next.add(r.keyword));
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <input
          value={rawFilter}
          onChange={(e) => setRawFilter(e.target.value)}
          placeholder="กรองในผลลัพธ์…"
          className="w-52 rounded-lg border border-line bg-page px-3 py-1.5 text-sm outline-none placeholder:text-faint focus:border-brand"
        />

        <div className="flex flex-wrap items-center gap-1">
          {counts.map((g) => {
            const on = g.id === group;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                disabled={g.count === 0 && g.id !== "all"}
                className={
                  "rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 " +
                  (on ? "border-brand bg-brandSoft text-brand font-medium" : "border-line text-muted hover:text-ink")
                }
              >
                {g.label}
                <span className="ml-1.5 tabular-nums opacity-70">{fmtNumber(g.count)}</span>
              </button>
            );
          })}
        </div>

        <span className="ml-auto text-xs text-muted">
          {filter || group !== "all"
            ? "แสดง " + fmtNumber(visible.length) + " จาก " + fmtNumber(rows.length) + " คำ"
            : fmtNumber(rows.length) + " คำ"}
        </span>
        {selected.size > 0 ? <span className="text-xs text-brand">เลือก {fmtNumber(selected.size)}</span> : null}
        <span className="w-full text-[11px] text-faint sm:w-auto">คลิกที่แถวเพื่อดูกราฟของคำนั้น</span>
      </div>

      <div className={GRID + " h-9 border-b border-line bg-raised text-muted"}>
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          aria-label="เลือกทั้งหมดในหน้านี้"
          className="h-3.5 w-3.5 accent-current text-brand"
        />
        <SortButton id="keyword" sort={sort} setSort={setSort}>คำค้นหา</SortButton>
        <SortButton id="volume" sort={sort} setSort={setSort} className="justify-end">เฉลี่ย · เดือนล่าสุด</SortButton>
        <SortButton id="trend" sort={sort} setSort={setSort} className="justify-end">แนวโน้ม</SortButton>
        <span className="text-xs font-medium text-muted">กราฟ</span>
        <SortButton id="competition" sort={sort} setSort={setSort} className="justify-end">การแข่งขัน</SortButton>
      </div>

      <div
        ref={scroller}
        onScroll={(e) => { setScrollTop(e.currentTarget.scrollTop); setHover(null); }}
        onMouseLeave={() => setHover(null)}
        style={{ height: Math.min(VIEWPORT_H, Math.max(ROW_H * 3, visible.length * ROW_H)) }}
        className="relative overflow-y-auto"
      >
        <div style={{ height: visible.length * ROW_H }} className="relative">
          {slice.map((row, i) => {
            const index = start + i;
            const up = row.trendPct !== null && row.trendPct > 0;
            const down = row.trendPct !== null && row.trendPct < 0;
            const brand = brandLabel(row.brand);
            const isFocused = focused === row.keyword;
            return (
              <div
                key={row.keyword}
                onClick={() => onFocus?.(isFocused ? null : row.keyword)}
                style={{ position: "absolute", top: index * ROW_H, height: ROW_H, left: 0, right: 0 }}
                className={
                  GRID + " cursor-pointer border-b border-line/50 " +
                  (isFocused ? "bg-brandSoft" : "hover:bg-raised")
                }
              >
                <input
                  type="checkbox"
                  checked={selected.has(row.keyword)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(row.keyword)) next.delete(row.keyword);
                      else next.add(row.keyword);
                      return next;
                    })
                  }
                  aria-label={"เลือก " + row.keyword}
                  className="h-3.5 w-3.5 accent-current text-brand"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={"truncate text-sm font-medium " + (isFocused ? "text-brand" : "")} title={row.keyword}>
                      {row.keyword}
                    </span>
                    {row.silentMonths >= 2 ? (
                      <span
                        title={"ไม่มีคนค้นเลย " + row.silentMonths + " เดือนล่าสุด"}
                        className="shrink-0 rounded border border-down/40 px-1 text-[9px] leading-4 text-down"
                      >
                        เงียบ {row.silentMonths} เดือน
                      </span>
                    ) : null}
                    {row.duplicateOf ? (
                      <span
                        title={"คำค้นเดียวกับ " + row.duplicateOf + " ไม่ถูกนับซ้ำในยอดรวม"}
                        className="shrink-0 rounded border border-line px-1 text-[9px] leading-4 text-faint"
                      >
                        ซ้ำ
                      </span>
                    ) : null}
                  </div>
                  {brand ? <div className="text-[10px] leading-none text-faint">{brand}</div> : null}
                </div>

                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">{fmtNumber(row.volume)}</div>
                  {row.latest ? (
                    <div className="text-[10px] leading-none text-faint tabular-nums">
                      {monthLabel(row.latest)} {fmtNumber(row.latest.volume)}
                    </div>
                  ) : null}
                  {/* "—" เฉยๆ อ่านเหมือนไม่มีคนค้นคำนี้ ทั้งที่จริงคือโหมดนี้ไม่มีข้อมูล
                      โหมดคำเดียวใช้ข้อมูลคนละชุดและมีคำแบรนด์หลายคำที่โหมดนี้ไม่มี
                      วัดเจอ 6 ก.ย. 2569 — หวยพร้อม โหมดหลายคำได้ NULL โหมดคำเดียวได้ 5,400 */}
                  {row.volume === null && onRetrySingle ? (
                    <button
                      type="button"
                      title="ตรวจอีกชุดข้อมูลหนึ่งของ Google · บางคำมีเฉพาะที่นั่น แต่ถ้าเป็นแบรนด์ใหม่จริงก็จะได้ขีดเหมือนเดิม"
                      onClick={(e) => { e.stopPropagation(); onRetrySingle(row.keyword); }}
                      className="mt-0.5 rounded border border-brand/40 px-1 text-[9px] leading-4 text-brand hover:bg-brandSoft"
                    >
                      ลองโหมดคำเดียว
                    </button>
                  ) : null}
                </div>

                <div
                  onMouseEnter={(e) => setHover({ row, ...anchorOf(e) })}
                  onMouseLeave={() => setHover(null)}
                  className={"text-right text-sm tabular-nums " + (up ? "text-up" : down ? "text-down" : "text-faint")}
                >
                  {up ? "↑" : down ? "↓" : ""} {fmtTrend(row.trendPct)}
                </div>

                <div
                  onMouseEnter={(e) => setHover({ row, ...anchorOf(e) })}
                  onMouseLeave={() => setHover(null)}
                  className="flex cursor-pointer justify-center"
                >
                  <MiniTrend months={row.months} tone={up ? "up" : down ? "down" : "bar"} />
                </div>

                <div className={"text-right text-sm " + competitionTone(row.competition)}>
                  {competitionLabel(row.competition)}
                  {row.competitionIndex !== null ? (
                    <span className="ml-1 text-[11px] text-faint tabular-nums">{row.competitionIndex}</span>
                  ) : null}
                </div>
              </div>
            );
          })}

          {visible.length === 0 ? (
            <div className="grid h-32 place-items-center text-sm text-faint">ไม่มีคำที่ตรงกับตัวกรอง</div>
          ) : null}
        </div>
      </div>

      {truncated ? (
        <div className="border-t border-line bg-brandSoft px-3 py-2.5 text-xs text-muted">
          ซ่อนไว้อีก <span className="font-semibold text-ink">{fmtNumber(truncated.hidden)}</span> คำ · {truncated.reason}
        </div>
      ) : null}

      <TrendPopover row={hover?.row} anchor={hover} />
    </div>
  );
}
