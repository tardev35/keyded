// ข้อความที่ส่งกลับหน้าเว็บต้องไม่มี URL, key หรือ stack — ของจริงถูกเก็บไว้ใน
// search_logs.error ตอนบันทึก log แล้ว (PLAN ข้อ 7)
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = Number(err?.status) || 500;
  const safe = err?.userMessage || (status < 500 ? err?.message : null);

  if (status >= 500) {
    console.error("[error]", req.method, req.originalUrl, "·", err?.detail || err?.message || err);
  }

  return res.status(status).json({
    error: safe || "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง",
    code: err?.code || "internal_error",
    ...(err?.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : {}),
  });
}

export const notFound = (req, res) => res.status(404).json({ error: "ไม่พบเส้นทางนี้", code: "not_found" });
