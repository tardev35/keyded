import { env } from "../config/env.js";

// เพดานจริงของ DataForSEO คือ 12 คำขอ/นาที ต่อบัญชี (วัดจริง 4 ก.ย. 2569 จาก header
// X-RateLimit-Limit) · ตั้งไว้ 10 เพื่อกันเวลานาฬิกาสองฝั่งไม่ตรงกัน (PLAN ข้อ 2.8 ชั้น 3)
const CAPACITY = env.RATE_PER_MINUTE;
const REFILL_MS = 60000 / CAPACITY;

let tokens = CAPACITY;
let lastRefill = Date.now();

function refill() {
  const now = Date.now();
  const gained = Math.floor((now - lastRefill) / REFILL_MS);
  if (gained > 0) {
    tokens = Math.min(CAPACITY, tokens + gained);
    lastRefill += gained * REFILL_MS;
  }
}

const waiting = new Map();
const order = [];
const activeUsers = new Set();
const inflight = new Map();

let pumping = false;

function enqueue(userId, job) {
  if (!waiting.has(userId)) {
    waiting.set(userId, []);
    order.push(userId);
  }
  waiting.get(userId).push(job);
}

// วนหยิบทีละคนต่อรอบ ไม่ใช่ FIFO — คนที่ส่งมา 10 งานต้องไม่บังคิวคนที่ส่งมางานเดียว
// (PLAN ข้อ 2.8 ชั้น 5)
function nextJob() {
  for (let i = 0; i < order.length; i += 1) {
    const userId = order.shift();
    order.push(userId);
    const queue = waiting.get(userId);
    if (!queue || queue.length === 0) continue;
    if (activeUsers.has(userId)) continue;
    const job = queue.shift();
    if (queue.length === 0) {
      waiting.delete(userId);
      const at = order.indexOf(userId);
      if (at >= 0) order.splice(at, 1);
    }
    return job;
  }
  return null;
}

function pump() {
  if (pumping) return;
  pumping = true;
  queueMicrotask(async function loop() {
    for (;;) {
      refill();
      if (tokens < 1) break;
      const job = nextJob();
      if (!job) break;
      tokens -= 1;
      activeUsers.add(job.userId);
      job.start();
    }
    pumping = false;
    if (pendingCount() > 0) setTimeout(pump, Math.max(50, REFILL_MS / 4));
  });
}

function pendingCount() {
  let n = 0;
  for (const q of waiting.values()) n += q.length;
  return n;
}

export function queueStatus() {
  refill();
  return {
    tokens,
    capacity: CAPACITY,
    pending: pendingCount(),
    active: activeUsers.size,
  };
}

export function estimateWaitSeconds(position) {
  return Math.round((position / CAPACITY) * 60);
}

// สองชั้นซ้อนกัน — ชั้นที่ 2 รวมคำขอเดียวกันที่กำลังวิ่งอยู่ให้ยิงครั้งเดียว
// แล้วแจกผลให้ทุกคนที่รออยู่ · ชั้นที่ 4 กันคนเดียวเปิดสิบแท็บกินคิวสิบช่อง
export function schedule({ userId, key, run }) {
  const shared = inflight.get(key);
  if (shared) return { promise: shared.promise, deduped: true, position: 0 };

  const position = pendingCount() + 1;
  let resolveOuter;
  let rejectOuter;
  const promise = new Promise((resolve, reject) => {
    resolveOuter = resolve;
    rejectOuter = reject;
  });

  const entry = { promise };
  inflight.set(key, entry);

  const finish = () => {
    activeUsers.delete(userId);
    inflight.delete(key);
    pump();
  };

  enqueue(userId, {
    userId,
    start: () => {
      Promise.resolve()
        .then(run)
        .then((value) => { finish(); resolveOuter(value); })
        .catch((err) => { finish(); rejectOuter(err); });
    },
  });

  pump();
  return { promise, deduped: false, position };
}
