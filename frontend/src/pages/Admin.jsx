import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { fmtNumber } from "../lib/format.js";

const money = (v) => (v === null || v === undefined ? "—" : "$" + Number(v).toFixed(2));

const ROLE_LABEL = { admin: "ผู้ดูแล", paid: "สมาชิกจ่าย", free: "ฟรี" };

function Stat({ label, value, foot }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {foot ? <div className="mt-0.5 text-[11px] leading-tight text-faint">{foot}</div> : null}
    </div>
  );
}

const field =
  "rounded-lg border border-line bg-page px-2.5 py-1.5 text-sm outline-none placeholder:text-faint focus:border-brand";

function AddUserForm({ onDone, onError }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "free", creditsDaily: 5 });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white"
      >
        + เพิ่มผู้ใช้
      </button>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/admin/users", { ...form, creditsDaily: Number(form.creditsDaily) });
      setForm({ email: "", name: "", password: "", role: "free", creditsDaily: 5 });
      setOpen(false);
      onDone();
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-wrap items-end gap-2 rounded-xl border border-line bg-surface p-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted">อีเมล</span>
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field + " w-56"} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted">ชื่อ</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field + " w-40"} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted">รหัสผ่าน</span>
        <input required minLength={8} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field + " w-44"} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted">ระดับ</span>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={field}>
          <option value="free">ฟรี</option>
          <option value="paid">สมาชิกจ่าย</option>
          <option value="admin">ผู้ดูแล</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted">ค้นหา/วัน</span>
        <input type="number" min={0} value={form.creditsDaily} onChange={(e) => setForm({ ...form, creditsDaily: e.target.value })} className={field + " w-24 text-right tabular-nums"} />
      </label>
      <button type="submit" disabled={busy} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "กำลังบันทึก…" : "บันทึก"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-3 py-2 text-sm text-muted">
        ยกเลิก
      </button>
    </form>
  );
}

function UserRow({ user, me, onPatch, onDelete }) {
  const [quota, setQuota] = useState(String(user.creditsDaily));
  const isMe = String(user.id) === String(me?.id);

  useEffect(() => setQuota(String(user.creditsDaily)), [user.creditsDaily]);

  const saveQuota = () => {
    const next = Number(quota);
    if (!Number.isFinite(next) || next < 0 || next === user.creditsDaily) {
      setQuota(String(user.creditsDaily));
      return;
    }
    onPatch(user.id, { creditsDaily: next });
  };

  const changePassword = () => {
    const next = window.prompt("รหัสผ่านใหม่ของ " + user.email + " (อย่างน้อย 8 ตัวอักษร)");
    if (next === null) return;
    if (next.length < 8) return onPatch(user.id, {}, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    onPatch(user.id, { password: next });
  };

  return (
    <tr className="border-b border-line/50 last:border-0">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 font-medium">
          {user.email}
          {isMe ? <span className="rounded border border-line px-1 text-[9px] text-faint">คุณ</span> : null}
        </div>
        <div className="text-[11px] text-faint">
          {user.name || "ไม่ระบุชื่อ"}
          {user.disabled ? <span className="ml-1.5 text-down">ถูกระงับ</span> : null}
        </div>
      </td>

      <td className="px-3 py-2">
        <select
          value={user.role}
          disabled={isMe}
          onChange={(e) => onPatch(user.id, { role: e.target.value })}
          className={field + " text-xs disabled:opacity-50"}
        >
          <option value="free">ฟรี</option>
          <option value="paid">สมาชิกจ่าย</option>
          <option value="admin">ผู้ดูแล</option>
        </select>
      </td>

      <td className="px-3 py-2 text-right">
        {user.role === "admin" ? (
          <span className="text-xs text-faint">ไม่จำกัด</span>
        ) : (
          <input
            type="number"
            min={0}
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            onBlur={saveQuota}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className={field + " w-20 text-right text-xs tabular-nums"}
          />
        )}
      </td>

      <td className="px-3 py-2 text-right">
        <span className="tabular-nums">{user.role === "admin" ? "—" : fmtNumber(user.creditsLeft)}</span>
        {user.role === "admin" ? null : (
          <button
            type="button"
            onClick={() => onPatch(user.id, { resetToday: true })}
            title="คืนโควตาของวันนี้ให้เต็ม"
            className="ml-2 rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-ink"
          >
            รีเซ็ต
          </button>
        )}
      </td>

      <td className="px-3 py-2 text-right text-[11px] text-faint">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }) : "ยังไม่เคยเข้า"}
      </td>

      <td className="px-3 py-2">
        <div className="flex justify-end gap-1.5">
          <button type="button" onClick={changePassword} className="rounded-lg border border-line px-2 py-1 text-[11px] text-muted hover:text-ink">
            รหัสผ่าน
          </button>
          <button
            type="button"
            onClick={() => onPatch(user.id, { disabled: !user.disabled })}
            disabled={isMe}
            className="rounded-lg border border-line px-2 py-1 text-[11px] text-muted hover:text-ink disabled:opacity-40"
          >
            {user.disabled ? "เปิดใช้" : "ระงับ"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(user)}
            disabled={isMe}
            className="rounded-lg border border-down/40 px-2 py-1 text-[11px] text-down hover:bg-down/10 disabled:opacity-40"
          >
            ลบ
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Admin() {
  const { user: me } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // โหลดสองส่วนแยกกัน ถ้าฝั่งสถิติล่ม (เช่นต่อ DataForSEO ไม่ได้) ตารางผู้ใช้ต้องยังใช้งานได้
  // ไม่ใช่จอขาวทั้งหน้า
  const load = async () => {
    setLoading(true);
    const [s, u] = await Promise.allSettled([api.get("/admin/stats"), api.get("/admin/users")]);
    if (s.status === "fulfilled") setStats(s.value.data);
    if (u.status === "fulfilled") setUsers(u.value.data.items);
    const failed = [s, u].find((x) => x.status === "rejected");
    setError(failed ? errorText(failed.reason) : null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const patch = async (id, body, forcedError) => {
    if (forcedError) return setError(forcedError);
    try {
      setError(null);
      await api.patch("/admin/users/" + id, body);
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const remove = async (target) => {
    if (!window.confirm("ลบบัญชี " + target.email + " ถาวร? ประวัติการค้นหาจะยังอยู่แต่ไม่ผูกกับใคร")) return;
    try {
      setError(null);
      await api.delete("/admin/users/" + target.id);
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">ผู้ดูแลระบบ</h1>
          <p className="text-xs text-muted">ตัวเลข 30 วันล่าสุด · อัตราโดนแคชคือตัวคูณกำไรโดยตรง</p>
        </div>
        <AddUserForm onDone={load} onError={setError} />
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-down/40 bg-surface px-4 py-3 text-sm text-down">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={load} className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-ink">
            ลองใหม่
          </button>
        </div>
      ) : null}

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="การค้นหาทั้งหมด" value={fmtNumber(stats.totalSearches)} />
          <Stat
            label="อัตราโดนแคช"
            value={stats.cacheHitRate === null ? "—" : stats.cacheHitRate + "%"}
            foot={fmtNumber(stats.cachedKeywords) + " คำในแคช"}
          />
          <Stat
            label="ค่า API ที่ยืนยันได้"
            value={money(stats.spend)}
            foot={
              stats.unconfirmed?.timeouts
                ? "อีก " + stats.unconfirmed.timeouts + " ครั้งที่ timeout อาจถูกคิดแล้วราว " + money(stats.unconfirmed.estimatedCost)
                : null
            }
          />
          <Stat label="ยอดคงเหลือ DataForSEO" value={money(stats.account?.balance)} foot="ตัวเลขนี้คือความจริง ยอดซ้ายอาจต่ำกว่า" />
        </div>
      ) : null}

      {stats ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-2 text-sm font-medium">แยกตามสถานะ</div>
          <div className="flex flex-wrap gap-2">
            {stats.byStatus.map((s) => (
              <span key={s.status} className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted">
                {s.label} · <span className="tabular-nums text-ink">{fmtNumber(s.count)}</span>
                {s.cost ? <span className="ml-1 text-faint">{money(s.cost)}</span> : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-line bg-raised text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ผู้ใช้</th>
              <th className="px-3 py-2 text-left font-medium">ระดับ</th>
              <th className="px-3 py-2 text-right font-medium">ค้นหา/วัน</th>
              <th className="px-3 py-2 text-right font-medium">เหลือวันนี้</th>
              <th className="px-3 py-2 text-right font-medium">เข้าล่าสุด</th>
              <th className="px-3 py-2 text-right font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <UserRow key={u.id} user={u} me={me} onPatch={patch} onDelete={remove} />
            ))}
            {loading && !users ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted">กำลังโหลด…</td></tr>
            ) : null}
            {users && users.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-faint">ยังไม่มีผู้ใช้</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="pb-6 text-[11px] leading-relaxed text-faint">
        โควตาต่อวันตั้งแยกรายคนได้ · แก้แล้วมีผลทันที ถ้าลดโควตาต่ำกว่าที่เหลืออยู่ ระบบจะตัดยอดคงเหลือลงตาม ·
        ปุ่มรีเซ็ตคืนโควตาของวันนี้ให้เต็มโดยไม่ต้องรอเที่ยงคืน · ผู้ดูแลค้นหาได้ไม่จำกัดและไม่ถูกหักเครดิต
      </p>
    </div>
  );
}
