import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import { api, getAuthToken, setAuthToken } from "./lib/api";

export default function App() {
  const [password, setPassword] = useState(getAuthToken());
  const [authenticated, setAuthenticated] = useState(Boolean(getAuthToken()));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authenticated || !getAuthToken()) return;
    api.bots().catch(() => setAuthenticated(false));
  }, [authenticated]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setAuthToken(password);
    try {
      await api.bots();
      setAuthenticated(true);
    } catch {
      setAuthToken("");
      setError("Invalid admin password");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setAuthToken("");
    setPassword("");
    setAuthenticated(false);
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#334155,#070814_42%)] px-4 py-16">
        <form onSubmit={login} className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Botflix</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Admin access</h1>
          <p className="mt-2 text-sm text-slate-300">Use the configured ADMIN_PASSWORD to manage bots, payments, and logs.</p>
          <input className="mt-8 w-full rounded-xl border border-white/20 px-4 py-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin password" required />
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <button className="mt-6 w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60" disabled={loading}>{loading ? "Checking..." : "Enter dashboard"}</button>
        </form>
      </main>
    );
  }

  return <Dashboard onLogout={logout} />;
}
