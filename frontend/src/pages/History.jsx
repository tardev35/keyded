import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorText } from "../lib/api.js";
import { fmtNumber } from "../lib/format.js";

const TONE = {
  ok: "text-up",
  cached: "text-brand",
  quota_exceeded: "text-bar",
  api_error: "text-down",
  timeout: "text-down",
  throttled: "text-bar",
  invalid_keyword: "text-bar",
};

const usd = (v) => (v === null || v === undefined ? "—" : "$" + Number(v).toFixed(4));
const baht = (v, rate) => (v === null || v === undefined ? "—" : "฿" + (Number(v) * rate).toFixed(2));

function Stat({ label, value, foot, tone = "" }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={"mt-1 text-xl font-semibold tabular-nums " + tone}>{value}</div>
      {foot ? <div className="mt-0.5 text-[11px] leading-tight text-faint">{foot}</div> : null}
    </div>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/logs?limit=200").then((r) => setData(r.data)).catch((e) => setError(errorText(e)));
  }, []);

  if (error) return <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-down">{error}</div>;
  if (!data) return <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted">กำลังโหลด…</div>;

  const t = data.totals;
  const isAdmin = Boolean(data.isAdmin);
  const showCost = isAdmin;
  const rate = t.usdThb;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5">
      <div>
        <h1 className="text-lg font-semibold">ประวัติการค้นหา</h1>
        <p className="text-xs text-muted">คลิกที่แถวเพื่อเปิดดูผลเดิม · ผลที่ยังอยู่ในแคชเปิดดูได้ฟรี ไม่หักเครดิต</p>
      </div>

      <div className={"grid grid-cols-2 gap-3 " + (showCost ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        <Stat label="ค้นหาทั้งหมด" value={fmtNumber(t.searches)} foot={"เครดิตที่ใช้ " + fmtNumber(t.credits)} />
        {showCost ? null : (
          <Stat label="ใช้แคชได้" value={fmtNumber(t.cached)} tone="text-up" foot="ครั้งที่ตอบทันทีและไม่ถูกหักเครดิต" />
        )}
        {showCost ? null : (
          <Stat label="เครดิตที่ใช้ไป" value={fmtNumber(t.credits)} foot="นับเฉพาะครั้งที่ต้องดึงข้อมูลใหม่" />
        )}
        {showCost ? (
        <>
        <Stat
          label="ค่า API ที่จ่ายจริง"
          value={usd(t.cost)}
          foot={"≈ " + baht(t.cost, rate) + " ที่เรต " + rate + " บาท/ดอลลาร์"}
        />
        <Stat
          label="ประหยัดจากแคช"
          value={usd(t.savedCost)}
          tone="text-up"
          foot={fmtNumber(t.cached) + " ครั้งที่ไม่ต้องยิงใหม่ ≈ " + baht(t.savedCost, rate)}
        />
        <Stat
          label="อาจถูกคิดเพิ่ม"
          value={t.timeouts ? usd(t.unconfirmedCost) : "—"}
          tone={t.timeouts ? "text-down" : ""}
          foot={t.timeouts ? t.timeouts + " ครั้งที่ timeout ต้นทางคิดเงินไปแล้วแต่เราไม่ได้ข้อมูล" : "ไม่มี timeout"}
        />
        </>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="border-b border-line bg-raised text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">เวลา</th>
              <th className="px-3 py-2 text-left font-medium">คำค้นหา</th>
              {isAdmin ? <th className="px-3 py-2 text-left font-medium">สถานะ</th> : null}
              <th className="px-3 py-2 text-right font-medium">คำที่ได้</th>
              <th className="px-3 py-2 text-right font-medium">เครดิต</th>
              {showCost ? <th className="px-3 py-2 text-right font-medium">ค่าใช้จ่าย</th> : null}
              <th className="px-3 py-2 text-right font-medium">เวลาที่ใช้</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => {
              // เปิดผลเดิมได้เฉพาะครั้งที่ได้ข้อมูลจริง · ครั้งที่พลาดไม่มีอะไรให้ดู
              const canOpen = row.status === "ok" || row.status === "cached";
              return (
              <tr
                key={row.id}
                onClick={canOpen ? () => navigate("/?kw=" + encodeURIComponent(row.keyword) + "&loc=" + row.locationCode + "&lang=" + row.languageCode) : undefined}
                className={"border-b border-line/50 last:border-0 " + (canOpen ? "cursor-pointer hover:bg-raised" : "")}
              >
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                  {new Date(row.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-3 py-2 font-medium">
                  {row.keyword}
                  {canOpen ? <span className="ml-2 text-[10px] text-faint">เปิดดูผล</span> : null}
                  {!isAdmin && !canOpen ? (
                    <span className={"ml-2 text-[10px] " + (TONE[row.status] || "text-muted")}>{row.statusLabel}</span>
                  ) : null}
                </td>
                {isAdmin ? (
                  <td className={"px-3 py-2 text-xs " + (TONE[row.status] || "text-muted")}>{row.statusLabel}</td>
                ) : null}
                <td className="px-3 py-2 text-right tabular-nums">{row.resultCount === null ? "—" : fmtNumber(row.resultCount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.creditsUsed}</td>
                {showCost ? (
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.apiCost ? (
                    <span>
                      {usd(row.apiCost)}
                      <span className="ml-1.5 text-[11px] text-faint">{baht(row.apiCost, rate)}</span>
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                ) : null}
                <td className="px-3 py-2 text-right text-xs text-muted tabular-nums">
                  {row.durationMs === null ? "—" : fmtNumber(row.durationMs) + " ms"}
                </td>
              </tr>
              );
            })}
            {data.items.length === 0 ? (
              <tr><td colSpan={isAdmin ? 7 : 5} className="px-3 py-10 text-center text-sm text-faint">ยังไม่มีประวัติการค้นหา</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showCost ? (
        <p className="pb-6 text-[11px] text-faint">
          ค่าเงินบาทเป็นการประเมินที่เรตคงที่ {rate} บาท/ดอลลาร์ ไม่ใช่เรตสด · ตัวเลขดอลลาร์คือของจริงที่ DataForSEO แจ้งกลับมา
        </p>
      ) : null}
    </div>
  );
}
