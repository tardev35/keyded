import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { useKeywordSearch } from "../hooks/useKeywordSearch.js";
import SearchBar from "../components/SearchBar.jsx";
import MetricsCards from "../components/MetricsCards.jsx";
import TrendChart from "../components/TrendChart.jsx";
import KeywordTable from "../components/KeywordTable.jsx";
import SkeletonTable from "../components/SkeletonTable.jsx";
import { fmtNumber } from "../lib/format.js";

export default function Dashboard() {
  const { user, patchUser } = useAuth();
  const [markets, setMarkets] = useState(null);
  const [market, setMarket] = useState({ locationCode: 2764, languageCode: "th" });
  const [elapsed, setElapsed] = useState(0);
  const [focused, setFocused] = useState(null);

  const { result, loading, error, run } = useKeywordSearch({
    onCredits: ({ creditsLeft }) => {
      if (creditsLeft !== undefined) patchUser({ creditsLeft });
    },
  });

  useEffect(() => {
    api.get("/keywords/markets").then((r) => {
      setMarkets(r.data);
      setMarket({ locationCode: r.data.defaultLocation, languageCode: r.data.defaultLanguage });
    });
  }, []);

  useEffect(() => {
    if (!loading) return undefined;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => setFocused(null), [result]);

  const focusedRow = focused ? (result?.rows ?? []).find((r) => r.keyword === focused) ?? null : null;

  const unlimited = user?.role === "admin";
  const outOfCredit = !unlimited && (user?.creditsLeft ?? 0) <= 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 space-y-4">
      {markets ? (
        <SearchBar
          markets={markets}
          value={market}
          onChange={setMarket}
          loading={loading}
          disabled={outOfCredit}
          onSubmit={(keyword) => run({ path: "/keywords/search", body: { keyword, ...market } })}
          onSubmitBulk={(keywords) => run({ path: "/keywords/bulk", body: { keywords, ...market } })}
        />
      ) : (
        <div className="h-[5.75rem] rounded-xl border border-line bg-surface animate-pulse" />
      )}

      {outOfCredit ? (
        <div className="rounded-xl border border-line bg-brandSoft px-4 py-3 text-sm text-muted">
          โควตาการค้นหาวันนี้หมดแล้ว รอบใหม่เริ่มเที่ยงคืนตามเวลาไทย
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-down/40 bg-surface px-4 py-3 text-sm text-down">{error}</div>
      ) : null}

      {loading ? (
        <SkeletonTable
          note={
            elapsed > 20
              ? "กำลังถาม Google Ads… " + elapsed + " วินาที · คำกว้างใช้เวลาถึง 45 วินาที อย่าเพิ่งกดซ้ำ"
              : "กำลังถาม Google Ads… " + elapsed + " วินาที"
          }
        />
      ) : null}

      {!loading && result ? (
        <>
          {/* ป้ายบอกที่มาและเรื่องเครดิตถูกถอดออกตามที่ผู้ใช้ขอ · ความสดของข้อมูลยังอยู่ที่
              การ์ด "ช่วงข้อมูล" ส่วนโควตาคงเหลืออยู่บนหัวเว็บ (PLAN ข้อ 2.3) */}
          <h1 className="text-lg font-semibold">{result.keyword}</h1>

          {/* คำที่หายไประหว่างทางต้องบอกเสมอว่าหายกี่คำและเพราะอะไร (CLAUDE.md กฎข้อ 4) */}
          {result.invalid?.length || result.notFound?.length || result.overflow ? (
            <div className="space-y-1 rounded-xl border border-bar/40 bg-surface px-4 py-3 text-xs text-muted">
              {result.overflow ? (
                <div>ตัดออก {fmtNumber(result.overflow)} คำ เพราะเกินจำนวนสูงสุดต่อครั้ง</div>
              ) : null}
              {result.invalid?.length ? (
                <div>
                  ไม่ได้ส่ง {fmtNumber(result.invalid.length)} คำ —{" "}
                  {result.invalid.slice(0, 3).map((x) => x.keyword).join(" · ")}
                  {result.invalid.length > 3 ? " และอีก " + (result.invalid.length - 3) + " คำ" : ""}
                  <span className="text-faint"> ({result.invalid[0].reason})</span>
                </div>
              ) : null}
              {result.notFound?.length ? (
                <div>
                  ส่งไปแล้ว Google Ads ไม่คืนข้อมูล {fmtNumber(result.notFound.length)} คำ —{" "}
                  {result.notFound.slice(0, 5).join(" · ")}
                  {result.notFound.length > 5 ? " และอีก " + (result.notFound.length - 5) + " คำ" : ""}
                </div>
              ) : null}
            </div>
          ) : null}

          <MetricsCards
            summary={result.summary}
            truncated={result.truncated}
            source={result.source}
            fetchedAtThai={result.fetchedAtThai}
            ageDays={result.ageDays}
          />

          <TrendChart
            chart={focusedRow ? focusedRow.months : result.summary.chart}
            trendPct={focusedRow ? focusedRow.trendPct : result.summary.trendPct}
            trendMonths={focusedRow ? focusedRow.trendMonths : result.summary.trendMonths}
            title={focusedRow ? focusedRow.keyword : "ปริมาณค้นหารวมของทุกคำ ย้อนหลัง " + result.monthsBack + " เดือน"}
            onClear={focusedRow ? () => setFocused(null) : null}
          />

          <KeywordTable
            rows={result.rows}
            truncated={result.truncated}
            focused={focused}
            onFocus={setFocused}
          />

          <div className="pb-6 text-[11px] text-faint">— คือไม่มีข้อมูล ไม่ใช่ศูนย์</div>
        </>
      ) : null}

      {!loading && !result && !error ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-line py-16 text-center">
          <div className="text-sm text-muted">พิมพ์คำค้นหาด้านบนเพื่อเริ่มต้น</div>
          <div className="mt-1 text-xs text-faint">หนึ่งคำค้นหาได้คำที่เกี่ยวข้องหลายร้อยคำ พร้อมกราฟย้อนหลัง 24 เดือน</div>
        </div>
      ) : null}
    </div>
  );
}
