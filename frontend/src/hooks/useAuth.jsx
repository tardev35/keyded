import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, readAuth, writeAuth, errorText } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readAuth);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!auth?.token) {
      setReady(true);
      return () => { alive = false; };
    }
    api
      .get("/auth/me")
      .then((r) => {
        if (!alive) return;
        setAuth((prev) => {
          const next = { ...prev, user: r.data.user };
          writeAuth(next);
          return next;
        });
      })
      .catch(() => {
        if (alive) setAuth(null);
      })
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);

  const save = useCallback((data) => {
    writeAuth(data);
    setAuth(data);
  }, []);

  const login = useCallback(
    async (email, password) => {
      try {
        const r = await api.post("/auth/login", { email, password });
        save(r.data);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorText(err) };
      }
    },
    [save]
  );

  const register = useCallback(
    async (email, password, name) => {
      try {
        const r = await api.post("/auth/register", { email, password, name });
        save(r.data);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorText(err) };
      }
    },
    [save]
  );

  const logout = useCallback(() => {
    writeAuth(null);
    setAuth(null);
  }, []);

  const patchUser = useCallback((partial) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user: { ...prev.user, ...partial } };
      writeAuth(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user: auth?.user ?? null, ready, login, register, logout, patchUser }),
    [auth, ready, login, register, logout, patchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
