import axios from "axios";

const STORE = "keyded-auth";

export const readAuth = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "null");
  } catch {
    return null;
  }
};

export const writeAuth = (value) => {
  if (value) localStorage.setItem(STORE, JSON.stringify(value));
  else localStorage.removeItem(STORE);
};

export const api = axios.create({ baseURL: "/api", timeout: 60000 });

api.interceptors.request.use((config) => {
  const auth = readAuth();
  if (auth?.token) config.headers.Authorization = "Bearer " + auth.token;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config || {};
    const auth = readAuth();
    const canRetry = err.response?.status === 401 && auth?.refreshToken && !original.__retried;

    if (canRetry) {
      original.__retried = true;
      refreshing =
        refreshing ||
        axios
          .post("/api/auth/refresh", { refreshToken: auth.refreshToken })
          .then((r) => {
            writeAuth(r.data);
            return r.data;
          })
          .catch((e) => {
            writeAuth(null);
            throw e;
          })
          .finally(() => {
            refreshing = null;
          });
      try {
        const next = await refreshing;
        original.headers = { ...original.headers, Authorization: "Bearer " + next.token };
        return api(original);
      } catch {
        window.location.assign("/login");
      }
    }
    return Promise.reject(err);
  }
);

export const errorText = (err) =>
  err?.response?.data?.error || "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";
