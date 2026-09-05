import { useTheme } from "../hooks/useTheme.js";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      title={dark ? "เปลี่ยนเป็นธีมสว่าง" : "เปลี่ยนเป็นธีมมืด"}
      aria-label={dark ? "เปลี่ยนเป็นธีมสว่าง" : "เปลี่ยนเป็นธีมมืด"}
      className={
        "group relative h-8 w-[3.75rem] shrink-0 rounded-full border transition-colors duration-300 " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 " +
        (dark ? "border-brand/50 bg-brandSoft" : "border-line bg-raised")
      }
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-[0.4rem]">
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round"
          className={"transition-opacity duration-300 " + (dark ? "text-faint opacity-40" : "text-bar opacity-100")}
        >
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 1.8v2.4M12 19.8v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
        </svg>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          className={"transition-opacity duration-300 " + (dark ? "text-brand opacity-100" : "text-faint opacity-40")}
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </span>

      {/* ลูกกลมเลื่อนทับไอคอน ทำให้เห็นชัดว่าตอนนี้อยู่ฝั่งไหน · ใช้ transform ไม่ใช่ left
          จะได้เลื่อนบน GPU ไม่ไปรบกวน layout ของแถบหัวเว็บ */}
      <span
        className={
          "absolute top-1/2 left-[0.2rem] h-6 w-6 -translate-y-1/2 rounded-full shadow-md " +
          "transition-transform duration-300 ease-out " +
          (dark ? "translate-x-[1.75rem] bg-brand" : "translate-x-0 bg-surface")
        }
      >
        <span className="absolute inset-0 grid place-items-center">
          {dark ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-bar">
              <circle cx="12" cy="12" r="4.5" />
              <path d="M12 1.8v2.4M12 19.8v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}
