// รายการย่อที่ทีมใช้บ่อย · location_code 2764 = ไทย คือค่าที่ใช้ตอนวัดจริง 4 ก.ย. 2569
// รายการเต็มดึงได้ฟรีจาก keywords_data/google_ads/locations ถ้าวันหนึ่งต้องการครบ
export const LOCATIONS = [
  { code: 2764, name: "ไทย" },
  { code: 2840, name: "สหรัฐอเมริกา" },
  { code: 2826, name: "สหราชอาณาจักร" },
  { code: 2036, name: "ออสเตรเลีย" },
  { code: 2392, name: "ญี่ปุ่น" },
  { code: 2702, name: "สิงคโปร์" },
  { code: 2458, name: "มาเลเซีย" },
  { code: 2704, name: "เวียดนาม" },
  { code: 2360, name: "อินโดนีเซีย" },
  { code: 2608, name: "ฟิลิปปินส์" },
];

export const LANGUAGES = [
  { code: "th", name: "ไทย" },
  { code: "en", name: "อังกฤษ" },
  { code: "ja", name: "ญี่ปุ่น" },
  { code: "zh-CN", name: "จีนตัวย่อ" },
  { code: "id", name: "อินโดนีเซีย" },
  { code: "vi", name: "เวียดนาม" },
  { code: "ms", name: "มาเลย์" },
];

export const DEFAULT_LOCATION = 2764;
export const DEFAULT_LANGUAGE = "th";

export const isKnownLocation = (code) => LOCATIONS.some((l) => l.code === Number(code));
export const isKnownLanguage = (code) => LANGUAGES.some((l) => l.code === String(code));
