const SIZE = {
  sm: { text: "text-lg", pad: "px-1.5 py-0.5", radius: "rounded-md" },
  md: { text: "text-xl", pad: "px-2 py-0.5", radius: "rounded-lg" },
  lg: { text: "text-3xl", pad: "px-2.5 py-1", radius: "rounded-xl" },
};

// เคยใช้ไล่สีบนตัวอักษร (bg-clip-text) แล้วเส้นฟุ้งเพราะฟอนต์ขนาดเล็ก
// เปลี่ยนเป็นสีทึบบนพื้นทึบ คอนทราสต์คงที่ทั้งสองธีมและคมทุกขนาด
export default function Logo({ size = "sm", className = "" }) {
  const s = SIZE[size] || SIZE.sm;
  return (
    <span className={"inline-flex select-none items-center font-extrabold tracking-tight " + s.text + " " + className}>
      <span className="text-ink">Key</span>
      <span className={"ml-1 bg-brand text-white " + s.pad + " " + s.radius}>ded</span>
    </span>
  );
}
