import { useState } from "react";
import { useOnlineStatus, useUnsyncedCount } from "../lib/sync";
import { useAppStore } from "../state/appStore";
import { NavMenu } from "./NavMenu";

export function StatusBar() {
  const online = useOnlineStatus();
  const unsynced = useUnsyncedCount();
  const role = useAppStore((s) => s.role);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="4" x2="16" y2="4" />
                <line x1="2" y1="9" x2="16" y2="9" />
                <line x1="2" y1="14" x2="16" y2="14" />
              </g>
            </svg>
          </button>

          <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="text-slate-400">{online ? "Online" : "Offline"}</span>
          {unsynced > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
              {unsynced} pending sync
            </span>
          )}
        </div>

        {role && <span className="pr-1 capitalize text-slate-400">{role} mode</span>}
      </div>

      <NavMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
