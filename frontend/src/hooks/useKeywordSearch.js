import { useCallback, useRef, useState } from "react";
import { api, errorText } from "../lib/api.js";

export function useKeywordSearch({ onCredits }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inflight = useRef(false);

  // กันยิงซ้ำจากฝั่งหน้าเว็บชั้นหนึ่ง · ฝั่ง server กันอีกชั้นด้วย เพราะปุ่มอย่างเดียวไม่พอ
  // คนที่ยิง API ตรงข้ามหน้าเว็บไปได้ (PLAN ข้อ 6)
  const run = useCallback(
    async ({ path, body }) => {
      if (inflight.current) return;
      inflight.current = true;
      setLoading(true);
      setError(null);
      try {
        const res = await api.post(path, body);
        setResult(res.data);
        if (onCredits) onCredits({ creditsLeft: res.data.credits?.creditsLeft });
      } catch (err) {
        setError(errorText(err));
      } finally {
        inflight.current = false;
        setLoading(false);
      }
    },
    [onCredits]
  );

  return { result, loading, error, run, clearError: () => setError(null) };
}
