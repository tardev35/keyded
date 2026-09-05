const buckets = new Map();

const clientIp = (req) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
};

// จำกัดที่ระดับ IP ด้วย ไม่ใช่แค่ระดับ user — คนสมัครบัญชีฟรีรัวๆ แล้วดูดข้อมูล
// คือความเสี่ยงหลักของเครื่องมือแบบนี้ (PLAN ข้อ 7)
export function rateLimit({ windowMs, max, keyPrefix = "" , message }) {
  return (req, res, next) => {
    const key = keyPrefix + ":" + clientIp(req);
    const now = Date.now();
    const entry = buckets.get(key);

    if (!entry || now >= entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= max) {
      const seconds = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(seconds));
      return res.status(429).json({
        error: message || "ส่งคำขอถี่เกินไป ลองใหม่ในอีก " + seconds + " วินาที",
        retryAfterSeconds: seconds,
      });
    }
    entry.count += 1;
    return next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) if (now >= entry.resetAt) buckets.delete(key);
}, 60000).unref();
