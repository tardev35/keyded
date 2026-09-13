import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  const [focused, setFocused] = useState(null);
  const [params, setParams] = useSearchParams();
  const opened = useRef(false);

  const { result, loading, error, run } = useKeywordSearch({
    onCredits: ({ creditsLeft }) => {
      if (creditsLeft !== undefined) patchUser({ creditsLeft });
    },
  });

  useEffect(() => {
    api.get("/keywords/markets").then((r) => {
      setMarkets(r.data);
      const kw = params.get("kw");
      const kws = params.get("kws");
      const loc = Number(params.get("loc")) || r.data.defaultLocation;
      const lang = params.get("lang") || r.data.defaultLanguage;
      setMarket({ locationCode: loc, languageCode: lang });

      // เปิดจากหน้าประวัติ — ยิงครั้งเดียวแล้วล้าง query ทิ้งทันที
      // ไม่งั้นกดรีเฟรชหรือกดย้อนกลับจะยิงซ้ำโดยที่ผู้ใช้ไม่ได้สั่ง ซึ่งอาจเป็นเงินจริง
      if ((kw || kws) && !opened.current) {
        opened.current = true;
        setParams({}, { replace: true });
        run(kws
          ? { path: "/keywords/bulk", body: { keywords: kws.split("\n"), locationCode: loc, languageCode: lang } }
          : { path: "/keywords/search", body: { keyword: kw, locationCode: loc, languageCode: lang } });
      }
    });
  }, []);

  // กราฟเปิดมาที่คำที่ผู้ใช้ค้น ไม่ใช่ผลรวมทุกคำ — ผลรวมเอาไปเทียบกับเครื่องมืออื่นไม่ได้
  // เพราะแต่ละเจ้าแถมคำลูกมาไม่เท่ากัน คนอ่านจึงเห็นเลขไม่ตรงทั้งที่ข้อมูลตรง
  // ผลรวมยังดูได้อยู่ด้วยปุ่ม "ดูทุกคำ" บนหัวกราฟ
  useEffect(() => {
    const rows = result?.rows ?? [];
    const seed = result?.mode === "bulk" ? rows[0]?.keyword : result?.keyword;
    setFocused(seed && rows.some((r) => r.keyword === seed) ? seed : null);
  }, [result]);

  const focusedRow = focused ? (result?.rows ?? []).find((r) => r.keyword === focused) ?? null : null;

  const unlimited = user?.role === "admin" || user?.creditsDaily === 0;

  // นับแท่งที่วาดจริง ไม่ใช่ค่า monthsBack จาก config — ตั้งไว้ 24 แต่ Google คืนเดือนต้นทาง
  // มาด้วยจึงได้ 25 จุด หัวกราฟเคยเขียน 24 ทั้งที่มี 25 แท่ง (6 ก.ย. 2569)
  const chartMonths = result?.summary?.chart?.length ?? 0;
  // เลยเวลารีเซ็ตแล้วให้ถือว่ามีโควตาใหม่ ถึงยอดบนหน้าเว็บจะยังเป็น 0 — เปิดแท็บค้างข้ามคืน
  // ยอดจะไม่อัปเดตจนกว่าจะรีเฟรช ถ้ายังปิดปุ่มไว้จะค้นไม่ได้ ทั้งที่หลังบ้านรีเซ็ตให้ตอนกดค้นหาอยู่แล้ว
  const resetDue = user?.creditsResetAt && Date.now() >= new Date(user.creditsResetAt).getTime();
  const outOfCredit = !unlimited && !resetDue && (user?.creditsLeft ?? 0) <= 0;

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

      {loading ? <SkeletonTable /> : null}

      {!loading && result ? (
        <>
          {/* ป้ายบอกที่มาและเรื่องเครดิตถูกถอดออกตามที่ผู้ใช้ขอ · ความสดของข้อมูลยังอยู่ที่
              การ์ด "ช่วงข้อมูล" ส่วนโควตาคงเหลืออยู่บนหัวเว็บ (PLAN ข้อ 2.3) */}
          <h1 className="text-lg font-semibold">{result.keyword}</h1>

          {/* คำที่หายไประหว่างทางต้องบอกเสมอว่าหายกี่คำและเพราะอะไร (CLAUDE.md กฎข้อ 4) */}
          {result.invalid?.length || result.notFound?.length || result.overflow || result.sourceTotal > result.summary.totalRows ? (
            <div className="space-y-1 rounded-xl border border-bar/40 bg-surface px-4 py-3 text-xs text-muted">
              {result.sourceTotal > result.summary.totalRows ? (
                <div>
                  แหล่งข้อมูลมีทั้งหมด {fmtNumber(result.sourceTotal)} คำ · ดึงมาแล้ว{" "}
                  {fmtNumber(result.summary.totalRows)} คำ ที่เหลือยังไม่ได้ดึงเพื่อคุมต้นทุน
                </div>
              ) : null}
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

          {/* โหมดหลายคำใช้ endpoint search_volume ซึ่งไม่มีคำแบรนด์จำนวนมากในฐาน
              วัดเจอ 6-7 ก.ย. 2569 — หวยพร้อม กับ theflash168 ทั้งชุดคืน null ที่นี่
              แต่โหมดคำเดียวมีข้อมูลครบ · หน้าจอที่มีแต่ขีดโดยไม่บอกอะไร ทำให้ทีมคิดว่าระบบพัง
              หรือคิดว่าคำนั้นไม่มีคนค้น ซึ่งผิดทั้งคู่ */}
          {result.mode === "bulk" && result.summary.volumeUnknown > 0 ? (
            <div className="rounded-xl border border-bar/40 bg-bar/10 px-4 py-3 text-sm">
              <div className="font-medium">
                {result.summary.volumeCounted === 0
                  ? "โหมดหลายคำไม่มีข้อมูลของคำเหล่านี้เลยสักคำ (" + fmtNumber(result.summary.volumeUnknown) + " คำ)"
                  : fmtNumber(result.summary.volumeUnknown) + " จาก " + fmtNumber(result.summary.totalKeywords) + " คำไม่มีข้อมูลในโหมดหลายคำ"}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-muted">
                เป็นไปได้สองอย่าง — <span className="font-medium text-ink">แบรนด์ใหม่ที่ Google ยังไม่มีปริมาณค้นหา</span>
                {" "}ซึ่งจะได้ขีดทุกโหมด หรือ<span className="font-medium text-ink">คำที่มีเฉพาะในโหมดคำเดียว</span>
                {" "}เพราะสองโหมดดึงจากคนละชุดข้อมูลของ Google
              </div>
              <div className="mt-1 text-xs leading-relaxed text-faint">
                กดปุ่ม “ลองโหมดคำเดียว” ที่แถวของคำนั้นเพื่อตรวจอีกชุดหนึ่ง —
                เป็นการดึงข้อมูลใหม่ และอาจได้ขีดเหมือนเดิมถ้าคำนั้นใหม่จริง
              </div>
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
            title={focusedRow ? focusedRow.keyword : "ปริมาณค้นหารวมของทุกคำ ย้อนหลัง " + chartMonths + " เดือน"}
            onClear={focusedRow ? () => setFocused(null) : null}
          />

          <KeywordTable
            rows={result.rows}
            truncated={result.truncated}
            focused={focused}
            onFocus={setFocused}
            onRetrySingle={
              result.mode === "bulk"
                ? (keyword) => run({ path: "/keywords/search", body: { keyword, ...market } })
                : null
            }
          />

          <div className="pb-6 text-[11px] text-faint">— คือไม่มีข้อมูล ไม่ใช่ศูนย์</div>
        </>
      ) : null}

      {!loading && !result && !error ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-line py-16 text-center">
          <div className="text-sm text-muted">พิมพ์คำค้นหาด้านบนเพื่อเริ่มต้น</div>
          <div className="mt-1 text-xs text-faint">หนึ่งคำค้นหาได้คำที่เกี่ยวข้องหลายสิบถึงหลายร้อยคำ พร้อมกราฟย้อนหลัง</div>
        </div>
      ) : null}
    </div>
  );
}
