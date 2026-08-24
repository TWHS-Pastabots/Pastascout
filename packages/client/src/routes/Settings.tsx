import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../state/appStore";
import { api } from "../lib/api";

export function Settings() {
  const navigate = useNavigate();
  const serverUrl = useAppStore((s) => s.serverUrl);
  const setServerUrl = useAppStore((s) => s.setServerUrl);
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const [input, setInput] = useState(serverUrl);
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");

  async function testAndSave() {
    setStatus("checking");
    const trimmed = input.trim().replace(/\/$/, "");
    setServerUrl(trimmed);
    try {
      await api.health();
      setStatus("ok");
    } catch {
      setStatus("fail");
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-bold text-slate-100">Settings</h1>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold text-slate-100">Server address</h2>
        <p className="mt-1 text-sm text-slate-400">
          Point at the laptop hosting the event server (its local IP), or a cloud URL between events.
        </p>
        <input
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-green-500 focus:outline-none"
          placeholder="http://192.168.1.42:5174"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={testAndSave}
          className="mt-3 w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-500"
        >
          Save & test connection
        </button>
        {status === "checking" && <p className="mt-2 text-sm text-slate-400">Checking…</p>}
        {status === "ok" && <p className="mt-2 text-sm text-green-400">Connected.</p>}
        {status === "fail" && (
          <p className="mt-2 text-sm text-amber-400">
            Couldn't reach that server. That's fine while offline — entries still save locally and will sync later.
          </p>
        )}
      </section>

      <button
        onClick={() => {
          setRole(null);
          navigate("/");
        }}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        Switch role {role ? `(currently ${role})` : ""}
      </button>
    </div>
  );
}
