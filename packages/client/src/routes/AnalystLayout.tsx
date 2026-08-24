import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../state/appStore";
import { AnalystAuthGate } from "../components/AnalystAuthGate";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? "bg-green-600 text-white" : "bg-slate-800 text-slate-300"}`;

export function AnalystLayout() {
  const activeEventKey = useAppStore((s) => s.activeEventKey);
  const setActiveEventKey = useAppStore((s) => s.setActiveEventKey);
  const [events, setEvents] = useState<{ eventKey: string; name: string }[]>([]);

  useEffect(() => {
    api.events().then(setEvents).catch(() => {});
  }, []);

  return (
    <AnalystAuthGate>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-100">Analyst dashboard</h1>
          <select
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            value={activeEventKey}
            onChange={(e) => setActiveEventKey(e.target.value)}
          >
            <option value="">Select event…</option>
            {events.map((ev) => (
              <option key={ev.eventKey} value={ev.eventKey}>
                {ev.name} ({ev.eventKey})
              </option>
            ))}
          </select>
        </div>

        <nav className="flex flex-wrap gap-2">
          <NavLink to="/analyst" end className={tabClass}>
            Stats
          </NavLink>
          <NavLink to="/analyst/pick-list" className={tabClass}>
            Pick list
          </NavLink>
          <NavLink to="/analyst/import" className={tabClass}>
            TBA import
          </NavLink>
          <NavLink to="/analyst/join" className={tabClass}>
            Join (QR)
          </NavLink>
          <NavLink to="/analyst/receive" className={tabClass}>
            Receive via QR
          </NavLink>
        </nav>

        <Outlet />
      </div>
    </AnalystAuthGate>
  );
}
