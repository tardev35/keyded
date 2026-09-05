import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import Logo from "../components/Logo.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await login(form.username, form.password);
    setBusy(false);
    if (res.ok) navigate("/", { replace: true });
    else setError(res.error);
  };

  const field =
    "w-full rounded-lg border border-line bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center justify-between">
          <Logo size="md" />
          <ThemeToggle />
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-surface p-5">
          <div>
            <h1 className="text-base font-semibold">เข้าสู่ระบบ</h1>
            <p className="mt-0.5 text-xs text-muted">เครื่องมือวิจัยคำค้นหาจากข้อมูล Google Ads</p>
          </div>

          <input
            required
            autoFocus
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="ชื่อผู้ใช้"
            className={field}
          />

          <input
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="รหัสผ่าน"
            className={field}
          />

          {error ? <div className="rounded-lg bg-down/10 px-3 py-2 text-xs text-down">{error}</div> : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>

          {/* ไม่มีลิงก์สมัครสมาชิก — ผู้ดูแลเป็นคนตั้งบัญชีให้ ทุกบัญชีใหม่คือโควตาที่เสียเงินจริง */}
          <div className="pt-1 text-center text-xs text-faint">
            ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบเพื่อขอบัญชี
          </div>
        </form>
      </div>
    </div>
  );
}
