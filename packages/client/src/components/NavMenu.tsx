import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Role } from "../state/appStore";
import { useAppStore } from "../state/appStore";

interface NavItem {
  label: string;
  description: string;
  path: string;
  /** Role this page belongs to; picking it switches roles rather than bouncing to the home screen. */
  role: Role;
  icon: string;
}

const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Scouting",
    items: [
      {
        label: "Match scouting",
        description: "Pick a match and team to scout",
        path: "/scout",
        role: "scout",
        icon: "🎯",
      },
      {
        label: "Pit scouting",
        description: "Robot specs and capabilities",
        path: "/scout/pit",
        role: "scout",
        icon: "🔧",
      },
    ],
  },
  {
    heading: "Analysis",
    items: [
      {
        label: "Team stats",
        description: "OPR, EPA, and blended rankings",
        path: "/analyst",
        role: "analyst",
        icon: "📊",
      },
      {
        label: "Pick list",
        description: "Shared alliance selection order",
        path: "/analyst/pick-list",
        role: "analyst",
        icon: "📋",
      },
      {
        label: "Event setup",
        description: "Blue Alliance sync or manual import",
        path: "/analyst/import",
        role: "analyst",
        icon: "📥",
      },
      {
        label: "Join (QR)",
        description: "Get scouts' phones connected",
        path: "/analyst/join",
        role: "analyst",
        icon: "📱",
      },
    ],
  },
];

export function NavMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAppStore((s) => s.role);
  const scoutName = useAppStore((s) => s.scoutName);
  const setRole = useAppStore((s) => s.setRole);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function go(item: NavItem) {
    // Scouting needs a name attached to entries, so send them to the home
    // screen to enter one rather than into a form that can't be submitted.
    if (item.role === "scout" && !scoutName) {
      setRole(null);
      navigate("/");
      onClose();
      return;
    }
    if (role !== item.role) setRole(item.role);
    navigate(item.path);
    onClose();
  }

  function isActive(path: string) {
    if (path === "/analyst" || path === "/scout") return location.pathname === path;
    return location.pathname.startsWith(path);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      <nav
        aria-label="Main menu"
        className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-slate-800 bg-slate-950 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <p className="font-semibold text-slate-100">FRC Scouting</p>
            <p className="text-xs text-slate-500">
              {role ? `${role} mode` : "no role selected"}
              {scoutName ? ` · ${scoutName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {section.heading}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => go(item)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-start gap-3 rounded-lg px-2 py-2 text-left ${
                        active ? "bg-sky-950 ring-1 ring-sky-700" : "hover:bg-slate-900"
                      }`}
                    >
                      <span aria-hidden="true" className="text-base leading-5">
                        {item.icon}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-medium ${active ? "text-sky-300" : "text-slate-200"}`}>
                          {item.label}
                        </span>
                        <span className="block text-xs text-slate-500">{item.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-auto border-t border-slate-800 pt-3">
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">App</p>
            <button
              type="button"
              onClick={() => {
                navigate("/settings");
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-900"
            >
              <span aria-hidden="true">⚙️</span>
              <span className="text-sm font-medium text-slate-200">Settings</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRole(null);
                navigate("/");
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-900"
            >
              <span aria-hidden="true">🔄</span>
              <span className="text-sm font-medium text-slate-200">Switch role</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
