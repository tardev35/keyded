import { useEffect, useMemo, useState } from "react";

const parseList = (text) =>
  [...new Set(text.split(/[\r\n,]+/).map((k) => k.trim().toLowerCase()).filter(Boolean))];

export default function SearchBar({ markets, value, onChange, onSubmit, onSubmitBulk, loading, disabled }) {
  const [mode, setMode] = useState("single");
  const [keyword, setKeyword] = useState("");
  const [bulk, setBulk] = useState("");
  const [askSingle, setAskSingle] = useState(false);

  const list = useMemo(() => parseList(bulk), [bulk]);

  useEffect(() => {
    if (!askSingle) return;
    const onKey = (e) => e.key === "Escape" && setAskSingle(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [askSingle]);

  const submit = (e) => {
    e.preventDefault();
    if (loading || disabled) return;
    if (mode === "single") {
      const clean = keyword.trim();
      if (clean) onSubmit(clean);
      return;
    }
    if (!list.length) return;

    // โหมดหลายคำจ่ายเท่ากันไม่ว่าจะส่งไปกี่คำ ส่งคำเดียวจึงเป็นการจ่ายเต็มราคาเพื่อคำเดียว
    // และยังไม่ได้คำที่เกี่ยวข้องกลับมาด้วย · ถามก่อนดีกว่าปล่อยให้เผลอ (6 ก.ย. 2569)
    if (list.length === 1) return setAskSingle(true);
    onSubmitBulk(bulk);
  };

  const goSingle = () => {
    const only = list[0];
    setAskSingle(false);
    setMode("single");
    setKeyword(only);
    onSubmit(only);
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

      {/* เหลือแค่จำนวนคำ · เรื่องเครดิตกับต้นทุนไม่ต้องขึ้นตรงนี้
          โควตาคงเหลืออยู่บนหัวเว็บอยู่แล้ว */}
      {mode === "bulk" ? (
        <div className="mt-2 px-0.5 text-[11px] text-muted">
          {list.length ? list.length + " คำ (ตัดซ้ำแล้ว)" : "ยังไม่มีคำค้นหา"}
        </div>
      ) : null}

      {askSingle ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setAskSingle(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-2xl"
          >
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-brandSoft text-2xl">💡</div>

            <h2 className="text-base font-semibold text-ink">ใส่มาคำเดียว</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              โหมดหลายคำมีไว้เทียบหลายคำพร้อมกัน ถ้าจะดูคำว่า
              <span className="font-medium text-ink"> {list[0]} </span>
              คำเดียว โหมดคำเดียวเหมาะกว่า เพราะได้คำที่เกี่ยวข้องกลับมาด้วย
            </p>
            <div className="mt-5">
              <button
                type="button"
                autoFocus
                onClick={goSingle}
                className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white"
              >
                ไปโหมดคำเดียว
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
