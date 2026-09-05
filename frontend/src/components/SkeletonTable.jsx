const WIDTHS = ["w-48", "w-40", "w-56", "w-36", "w-52", "w-44", "w-60", "w-40", "w-48", "w-36"];

// รูปร่างต้องเหมือนตารางจริง ไม่ใช่วงกลมหมุน — คนจะเห็นว่ากำลังจะได้อะไร (PLAN ข้อ 6)
// แถบด้านบนวิ่งไม่รู้จบเพราะเราไม่รู้ว่าจะเสร็จเมื่อไหร่ ห้ามทำเป็นเปอร์เซ็นต์ปลอม
function Row({ width, delay }) {
  return (
    <div className="flex h-11 items-center gap-4 border-b border-line/60 px-4">
      <div className="keyded-shimmer h-4 w-4 rounded" style={{ animationDelay: delay }} />
      <div className={"keyded-shimmer h-3 rounded " + width} style={{ animationDelay: delay }} />
      <div className="keyded-shimmer ml-auto h-3 w-16 rounded" style={{ animationDelay: delay }} />
      <div className="keyded-shimmer h-3 w-12 rounded" style={{ animationDelay: delay }} />
      <div className="keyded-shimmer h-3 w-16 rounded" style={{ animationDelay: delay }} />
    </div>
  );
}

export default function SkeletonTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="relative h-0.5 overflow-hidden bg-line/40">
        <div className="keyded-sweep absolute inset-y-0 w-1/3 rounded-full bg-brand" />
      </div>

      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="keyded-shimmer h-4 w-4 rounded" />
        <div className="keyded-shimmer h-3 w-24 rounded" />
        <div className="keyded-shimmer ml-auto h-3 w-32 rounded" />
      </div>

      {WIDTHS.map((w, i) => (
        <Row key={w + i} width={w} delay={i * 70 + "ms"} />
      ))}
    </div>
  );
}
