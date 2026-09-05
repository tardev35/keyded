import { useMemo, useState } from "react";

const parseList = (text) =>
  [...new Set(text.split(/[\r\n,]+/).map((k) => k.trim().toLowerCase()).filter(Boolean))];

export default function SearchBar({ markets, value, onChange, onSubmit, onSubmitBulk, loading, disabled }) {
  const [mode, setMode] = useState("single");
  const [keyword, setKeyword] = useState("");
  const [bulk, setBulk] = useState("");

  const list = useMemo(() => parseList(bulk), [bulk]);

  const submit = (e) => {
    e.preventDefault();
    if (loading || disabled) return;
    if (mode === "single") {
      const clean = keyword.trim();
      if (clean) onSubmit(clean);
    } else if (list.length) {
      onSubmitBulk(bulk);
    }
  };

  const tab = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => setMode(id)}
      className={
        "rounded-lg px-3 py-1 text-xs transition-colors " +
        (mode === id ? "bg-brand text-white font-medium" : "text-muted hover:text-ink")
      }
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center gap-1 rounded-lg border border-line bg-page p-0.5 w-fit">
        {tab("single", "คำเดียว")}
        {tab("bulk", "หลายคำ")}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {mode === "single" ? (
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="พิมพ์คำค้นหา"
            maxLength={80}
            className="min-w-0 flex-1 rounded-lg border border-line bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        ) : (
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={5}
            placeholder={"วางคำค้นหาบรรทัดละหนึ่งคำ หรือคั่นด้วยจุลภาค\nโรงแรม เชียงใหม่\nที่พัก ภูเก็ต\nรีสอร์ท หัวหิน"}
            className="min-w-0 flex-1 resize-y rounded-lg border border-line bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        )}

        <div className="flex flex-col gap-2 sm:w-auto">
          <div className="flex gap-2">
            <select
              value={value.locationCode}
              onChange={(e) => onChange({ ...value, locationCode: Number(e.target.value) })}
              className="flex-1 rounded-lg border border-line bg-page px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              {markets.locations.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>

            <select
              value={value.languageCode}
              onChange={(e) => onChange({ ...value, languageCode: e.target.value })}
              className="flex-1 rounded-lg border border-line bg-page px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              {markets.languages.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || disabled || (mode === "single" ? !keyword.trim() : !list.length)}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? "กำลังค้นหา…" : "ค้นหา"}
          </button>
        </div>
      </div>

      {/* ต้นทุนต่อคำขอเป็นเรื่องภายใน ไม่แสดงให้ผู้ใช้ทั่วไปเห็น
          เหลือไว้แค่สิ่งที่กระทบตัวผู้ใช้เอง คือจำนวนคำและเครดิตที่จะถูกหัก */}
      {mode === "bulk" ? (
        <div className="mt-2 px-0.5 text-[11px] text-muted">
          {list.length ? list.length + " คำ (ตัดซ้ำแล้ว) · หัก 1 เครดิต" : "ยังไม่มีคำค้นหา"}
        </div>
      ) : null}
    </form>
  );
}
