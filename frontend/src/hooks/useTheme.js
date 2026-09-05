import { useCallback, useEffect, useState } from "react";

const KEY = "keyded-theme";

const current = () => (document.documentElement.classList.contains("dark") ? "dark" : "light");

// สคริปต์ใน index.html ใส่ class ให้ก่อนเบราว์เซอร์วาดเฟรมแรกไปแล้ว
// hook นี้แค่อ่านสถานะเดิมมาต่อ ห้ามตั้งค่าเริ่มต้นเองซ้ำ ไม่งั้นจะเห็นจอวาบตอนเปลี่ยนหน้า
export function useTheme() {
  const [theme, setTheme] = useState(current);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* โหมดส่วนตัวเขียนไม่ได้ ปล่อยให้ใช้ธีมของรอบนี้ไปก่อน */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return { theme, toggle };
}
