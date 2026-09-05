/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        page: "rgb(var(--c-page) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        raised: "rgb(var(--c-raised) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        faint: "rgb(var(--c-faint) / <alpha-value>)",
        brand: "rgb(var(--c-brand) / <alpha-value>)",
        brandSoft: "rgb(var(--c-brand-soft) / <alpha-value>)",
        brandAlt: "rgb(var(--c-brand-alt) / <alpha-value>)",
        up: "rgb(var(--c-up) / <alpha-value>)",
        down: "rgb(var(--c-down) / <alpha-value>)",
        bar: "rgb(var(--c-bar) / <alpha-value>)",
      },
      // Google Sans มีชุดอักษรไทยมาด้วย (ตรวจ unicode-range จาก fonts.googleapis.com 4 ก.ย. 2569)
      // จึงใช้ตัวเดียวได้ทั้งไทยและอังกฤษ ไม่ต้องผสมสองฟอนต์ให้ความสูงบรรทัดเพี้ยน
      fontFamily: {
        sans: ["Google Sans", "Noto Sans Thai", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
