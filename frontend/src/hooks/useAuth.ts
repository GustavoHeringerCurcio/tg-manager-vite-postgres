import { useState, useEffect, useCallback } from "react";
import { api, getAuthToken, setAuthToken } from "../lib/api";

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAuthToken()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .bots()
      .then(() => setAuthenticated(true))
      .catch(() => {
        setAuthToken("");
        setAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    setAuthToken(password);
    try {
      await api.bots();
      setAuthenticated(true);
    } catch {
      setAuthToken("");
      setError("Invalid admin password");
      throw new Error("Invalid admin password");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken("");
    setAuthenticated(false);
    setError(null);
  }, []);

  return { authenticated, loading, error, login, logout };
}
