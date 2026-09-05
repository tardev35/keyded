import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import Logo from "../components/Logo.jsx";

export default function Login({ mode = "login" }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = isRegister
      ? await register(form.email, form.password, form.name)
      : await login(form.email, form.password);
    setBusy(false);
    if (res.ok) navigate("/", { replace: true });
    else setError(res.error);
  };

  const field = "w-full rounded-lg border border-line bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center justify-between">
          <Logo size="md" />
          <ThemeToggle />
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-surface p-5">
          <div>
            <h1 className="text-base font-semibold">{isRegister ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}</h1>
            <p className="mt-0.5 text-xs text-muted">เครื่องมือวิจัยคำค้น</p>
          </div>

          {isRegister ? (
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ชื่อที่ใช้แสดง"
              className={field}
            />
          ) : null}

          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="อีเมล"
            className={field}
          />

          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={isRegister ? "รหัสผ่าน อย่างน้อย 8 ตัวอักษร" : "รหัสผ่าน"}
            className={field}
          />

          {error ? <div className="rounded-lg bg-down/10 px-3 py-2 text-xs text-down">{error}</div> : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "กำลังดำเนินการ…" : isRegister ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
          </button>

          <div className="pt-1 text-center text-xs text-muted">
            {isRegister ? (
              <>มีบัญชีแล้ว? <Link to="/login" className="text-brand hover:underline">เข้าสู่ระบบ</Link></>
            ) : (
              <>ยังไม่มีบัญชี? <Link to="/register" className="text-brand hover:underline">สมัครสมาชิก</Link></>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
