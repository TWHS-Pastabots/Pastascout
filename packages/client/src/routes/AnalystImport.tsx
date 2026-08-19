import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../state/appStore";

type TbaStatus = Awaited<ReturnType<typeof api.tbaStatus>>;

export function AnalystImport() {
  const activeEventKey = useAppStore((s) => s.activeEventKey);
  const setActiveEventKey = useAppStore((s) => s.setActiveEventKey);
  const [status, setStatus] = useState<TbaStatus | null>(null);

  async function refreshStatus() {
    try {
      setStatus(await api.tbaStatus());
    } catch {
      setStatus(null);
    }
  }

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {status?.configured ? (
        <AutoSyncPanel status={status} onRefresh={refreshStatus} onUseEvent={setActiveEventKey} />
      ) : (
        <NotConfiguredPanel />
      )}
      <ManualImportPanel defaultEventKey={activeEventKey} onImported={setActiveEventKey} />
    </div>
  );
}

function AutoSyncPanel({
  status,
  onRefresh,
  onUseEvent,
}: {
  status: TbaStatus;
  onRefresh: () => void;
  onUseEvent: (key: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function syncNow() {
    setBusy(true);
    try {
      await api.tbaSyncNow();
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <h2 className="font-semibold text-slate-100">Auto-syncing from The Blue Alliance</h2>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        The server pulls <span className="font-mono text-sky-300">{status.eventKey}</span> automatically — schedule
        and results stay up to date with no import step.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="Teams" value={String(status.teamCount)} />
        <Stat label="Matches" value={String(status.matchCount)} />
        <Stat
          label="Last sync"
          value={status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString() : "—"}
        />
        <Stat label="Status" value={status.lastError ? "Error" : status.syncing ? "Syncing…" : "OK"} />
      </dl>
      {status.lastError && <p className="mt-2 text-sm text-amber-400">Last error: {status.lastError}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={syncNow}
          disabled={busy}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-700"
        >
          {busy ? "Refreshing…" : "Refresh now"}
        </button>
        {status.eventKey && (
          <button
            onClick={() => onUseEvent(status.eventKey!)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white"
          >
            Use this event
          </button>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900/60 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-200">{value}</dd>
    </div>
  );
}

function NotConfiguredPanel() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">Automatic Blue Alliance sync (not set up)</h2>
      <p className="mt-1 text-sm text-slate-400">
        TBA requires an API key on every request, so the app can't pull from it with no key at all. But the key only
        has to be set up <span className="font-medium text-slate-200">once, by one person</span> — after that everyone
        else just opens the site and the event is already loaded.
      </p>
      <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm text-slate-400">
        <li>
          Someone who can sign in with Google gets a free read key at{" "}
          <span className="font-mono text-sky-300">thebluealliance.com/account</span> → "Read API Keys".
        </li>
        <li>
          Copy <span className="font-mono text-sky-300">packages/server/.env.example</span> to{" "}
          <span className="font-mono text-sky-300">.env</span> and fill in <span className="font-mono">TBA_API_KEY</span>{" "}
          and <span className="font-mono">TBA_EVENT_KEY</span>.
        </li>
        <li>Restart the server. This panel turns green and stays in sync on its own.</li>
      </ol>
      <p className="mt-3 text-sm text-slate-400">
        Can't get a key? Use the manual setup below — it needs no account and works completely offline.
      </p>
    </section>
  );
}

const SCHEDULE_PLACEHOLDER = `1, 254, 1114, 118, 971, 2056, 148
2, 971, 254, 148, 1114, 118, 2056`;

function ManualImportPanel({
  defaultEventKey,
  onImported,
}: {
  defaultEventKey: string;
  onImported: (key: string) => void;
}) {
  const [eventKey, setEventKey] = useState(defaultEventKey);
  const [eventName, setEventName] = useState("");
  const [teamsText, setTeamsText] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.manualImportEvent>> | null>(null);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await api.manualImportEvent({ eventKey, eventName, teamsText, scheduleText });
      setResult(res);
      onImported(res.eventKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">Set up an event manually (no key needed)</h2>
      <p className="mt-1 text-sm text-slate-400">
        Paste the match schedule from the event's posted schedule. Comma, tab, or space separated — a header row is
        fine.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-300">Event key</span>
            <input
              value={eventKey}
              onChange={(e) => setEventKey(e.target.value)}
              placeholder="2026myevent"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-300">Event name</span>
            <input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="My Regional"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">
            Match schedule — match#, red1, red2, red3, blue1, blue2, blue3
          </span>
          <textarea
            value={scheduleText}
            onChange={(e) => setScheduleText(e.target.value)}
            rows={6}
            placeholder={SCHEDULE_PLACEHOLDER}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">
            Team names (optional) — number, name per line
          </span>
          <textarea
            value={teamsText}
            onChange={(e) => setTeamsText(e.target.value)}
            rows={4}
            placeholder={"254, The Cheesy Poofs\n1114, Simbotics"}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={busy || !eventKey.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:bg-slate-700 disabled:text-slate-500"
        >
          {busy ? "Setting up…" : "Set up event"}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {result && (
          <div className="text-sm">
            <p className="text-emerald-400">
              Loaded {result.matchCount} matches and {result.teamCount} teams into {result.eventKey}.
            </p>
            {result.issues.length > 0 && (
              <div className="mt-2 rounded-lg border border-amber-900 bg-amber-950/40 p-2">
                <p className="font-medium text-amber-400">Skipped {result.issues.length} row(s):</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-amber-200/80">
                  {result.issues.slice(0, 8).map((issue, i) => (
                    <li key={i}>
                      Line {issue.line}: {issue.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
