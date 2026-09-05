import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import Logo from "./components/Logo.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import History from "./pages/History.jsx";
import Admin from "./pages/Admin.jsx";
import Login from "./pages/Login.jsx";

function NavLink({ to, children }) {
  const { pathname } = useLocation();
  const on = pathname === to;
  return (
    <Link
      to={to}
      className={"rounded-lg px-3 py-1.5 text-sm transition-colors " + (on ? "bg-brandSoft text-brand font-medium" : "text-muted hover:text-ink")}
    >
      {children}
    </Link>
  );
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2.5">
          <Link to="/" className="mr-2">
            <Logo size="sm" />
          </Link>
          <NavLink to="/">ค้นหา</NavLink>
          <NavLink to="/history">ประวัติ</NavLink>
          {user?.role === "admin" ? <NavLink to="/admin">ผู้ดูแล</NavLink> : null}

          <div className="ml-auto flex items-center gap-2">
            <span
              title={user?.role === "admin" ? "ผู้ดูแลค้นหาได้ไม่จำกัด" : "รอบใหม่เริ่มเที่ยงคืนตามเวลาไทย"}
              className="hidden rounded-lg border border-line px-2 py-1 text-[11px] text-muted sm:block"
            >
              {user?.role === "admin"
                ? "ค้นหาไม่จำกัด"
                : "เหลือวันนี้ " + (user?.creditsLeft ?? 0) + "/" + (user?.creditsDaily ?? 0)}
            </span>
            <span className="hidden text-xs text-muted md:block">{user?.email}</span>
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function Protected({ children, adminOnly = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="grid h-full place-items-center text-sm text-muted">กำลังตรวจสอบสิทธิ์…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login mode="login" />} />
          <Route path="/register" element={<Login mode="register" />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/history" element={<Protected><History /></Protected>} />
          <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
