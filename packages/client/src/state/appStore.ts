import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "scout" | "analyst";

interface AppState {
  role: Role | null;
  scoutName: string;
  serverUrl: string;
  activeEventKey: string;
  setRole: (r: Role | null) => void;
  setScoutName: (n: string) => void;
  setServerUrl: (u: string) => void;
  setActiveEventKey: (k: string) => void;
}

function defaultServerUrl(): string {
  // Production build (e.g. GitHub Pages): baked in at build time via
  // VITE_API_URL, since the client and API live on different hosts and there's
  // no ":5174 on the same host" to guess at. Falls through when unset.
  const built = import.meta.env.VITE_API_URL as string | undefined;
  if (built) return built.replace(/\/$/, "");

  if (typeof window === "undefined") return "http://localhost:5174";
  // Dev convenience: client runs on 5173, API server on 5174 on the same host.
  // Also covers the local-laptop-at-a-competition deployment, where scouts'
  // phones load the client from the analyst laptop's IP on port 5173.
  return `${window.location.protocol}//${window.location.hostname}:5174`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      role: null,
      scoutName: "",
      serverUrl: defaultServerUrl(),
      activeEventKey: "",
      setRole: (role) => set({ role }),
      setScoutName: (scoutName) => set({ scoutName }),
      setServerUrl: (serverUrl) => set({ serverUrl: serverUrl.replace(/\/$/, "") }),
      setActiveEventKey: (activeEventKey) => set({ activeEventKey }),
    }),
    { name: "frc-scout-app-state" }
  )
);
