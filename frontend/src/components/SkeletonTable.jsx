const WIDTHS = ["w-48", "w-40", "w-56", "w-36", "w-52", "w-44", "w-60", "w-40", "w-48", "w-36"];

// รูปร่างต้องเหมือนตารางจริง ไม่ใช่วงกลมหมุน — คนจะเห็นว่ากำลังจะได้อะไร
// และการบอกเวลาที่คาดไว้ล่วงหน้าลดการกดซ้ำได้มากกว่าอนิเมชันสวยๆ (PLAN ข้อ 6)
export default function SkeletonTable({ note }) {
  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex items-center gap-3">
        <div className="h-4 w-4 rounded bg-line animate-pulse" />
        <div className="h-3 w-24 rounded bg-line animate-pulse" />
        <div className="ml-auto h-3 w-32 rounded bg-line animate-pulse" />
      </div>
      {WIDTHS.map((w, i) => (
        <div key={i} className="px-4 h-11 flex items-center gap-4 border-b border-line/60">
          <div className="h-4 w-4 rounded bg-line animate-pulse" style={{ animationDelay: i * 60 + "ms" }} />
          <div className={"h-3 rounded bg-line animate-pulse " + w} style={{ animationDelay: i * 60 + "ms" }} />
          <div className="ml-auto h-3 w-16 rounded bg-line animate-pulse" style={{ animationDelay: i * 60 + "ms" }} />
          <div className="h-3 w-12 rounded bg-line animate-pulse" style={{ animationDelay: i * 60 + "ms" }} />
          <div className="h-3 w-16 rounded bg-line animate-pulse" style={{ animationDelay: i * 60 + "ms" }} />
        </div>
      ))}
      {note ? <div className="px-4 py-3 text-sm text-muted">{note}</div> : null}
    </div>
  );
}
