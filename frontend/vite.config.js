import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // ค่าเริ่มต้นของ Vite ผูกกับ localhost ซึ่งบน Windows กลายเป็น IPv6 (::1) อย่างเดียว
    // แล้วเบราว์เซอร์ที่ลอง 127.0.0.1 ก่อนจะเจอ connection refused
    // host: true ฟังทั้งสองสแตก · เปลี่ยนเป็น "127.0.0.1" ได้ถ้าไม่อยากให้เครื่องอื่นในวงแลนเห็น
    host: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:4000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
  },
});
