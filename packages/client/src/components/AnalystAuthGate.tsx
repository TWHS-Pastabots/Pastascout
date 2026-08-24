import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../state/appStore";

/**
 * Gates everything under it behind ANALYST_PASSWORD, when the server has one
 * configured. If the server has no password set, this is invisible — renders
 * children immediately, same as before this existed.
 *
 * Also reacts to the session token being cleared out from under it (e.g. the
 * server restarted and invalidated it — see AnalystAuthError in api.ts) by
 * re-showing the prompt automatically, since it just reads analystToken from
 * the store rather than caching an "unlocked" flag of its own.
 */
export function AnalystAuthGate({ children }: { children: React.ReactNode }) {
  const analystToken = useAppStore((s) => s.analystToken);
  const setAnalystToken = useAppStore((s) => s.setAnalystToken);

  const [required, setRequired] = useState<boolean | null>(null); // null = still checking
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .analystAuthStatus()
      .then((r) => setRequired(r.required))
      .catch(() => setRequired(false)); // can't reach the server — don't block on a gate we can't confirm
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.analystLogin(password);
      if (res.ok && res.token) {
        setAnalystToken(res.token);
      } else {
        setError("Incorrect password.");
      }
    } catch {
      setError("Incorrect password.");
    } finally {
      setBusy(false);
    }
  }

  if (required === null) return null; // brief flash avoided — checking before rendering either state
  if (!required || analystToken) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Analyst login</h1>
        <p className="mt-1 text-slate-400">This team's dashboard, rankings, and pick list are password-protected.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-green-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white disabled:bg-slate-700 disabled:text-slate-500"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </div>
  );
}
