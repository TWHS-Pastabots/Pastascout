import type { Match, MatchScoutingEntry, PitScoutingEntry } from "@frc-scout/shared";
import { useAppStore } from "../state/appStore";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const serverUrl = useAppStore.getState().serverUrl;
  const res = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => apiFetch<{ ok: boolean }>("/api/health"),

  events: () => apiFetch<{ eventKey: string; name: string; startDate?: string; endDate?: string }[]>("/api/events"),
  teams: () => apiFetch<{ teamNumber: number; name: string; tbaKey?: string }[]>("/api/teams"),
  matches: (eventKey?: string) =>
    apiFetch<Match[]>(`/api/matches${eventKey ? `?eventKey=${encodeURIComponent(eventKey)}` : ""}`),

  matchScoutingList: (params: { matchId?: string; teamNumber?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.matchId) qs.set("matchId", params.matchId);
    if (params.teamNumber) qs.set("teamNumber", String(params.teamNumber));
    return apiFetch<MatchScoutingEntry[]>(`/api/match-scouting?${qs.toString()}`);
  },
  postMatchScouting: (entry: MatchScoutingEntry) =>
    apiFetch<{ ok: boolean; id: string }>("/api/match-scouting", { method: "POST", body: JSON.stringify(entry) }),

  pitScoutingList: (params: { teamNumber?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.teamNumber) qs.set("teamNumber", String(params.teamNumber));
    return apiFetch<PitScoutingEntry[]>(`/api/pit-scouting?${qs.toString()}`);
  },
  postPitScouting: (entry: PitScoutingEntry) =>
    apiFetch<{ ok: boolean; id: string }>("/api/pit-scouting", { method: "POST", body: JSON.stringify(entry) }),

  importTba: (eventKey: string, apiKey?: string) =>
    apiFetch<{ ok: boolean; teamCount: number; matchCount: number }>("/api/tba/import", {
      method: "POST",
      body: JSON.stringify({ eventKey, apiKey }),
    }),

  tbaStatus: () =>
    apiFetch<{
      configured: boolean;
      eventKey: string | null;
      lastSyncAt: string | null;
      lastError: string | null;
      teamCount: number;
      matchCount: number;
      syncing: boolean;
    }>("/api/tba/status"),

  tbaSyncNow: () => apiFetch<{ lastSyncAt: string | null }>("/api/tba/sync-now", { method: "POST" }),

  manualImportEvent: (body: {
    eventKey: string;
    eventName?: string;
    teamsText?: string;
    scheduleText?: string;
  }) =>
    apiFetch<{
      ok: boolean;
      eventKey: string;
      teamCount: number;
      matchCount: number;
      issues: { line: number; text: string; reason: string }[];
    }>("/api/manual/event", { method: "POST", body: JSON.stringify(body) }),

  stats: (eventKey: string, weights?: Record<string, number>) =>
    apiFetch<{
      eventKey: string;
      weights: Record<string, number>;
      matchesPlayed: number;
      teams: {
        teamNumber: number;
        teamName: string;
        opr: number;
        epa: number;
        avgFuel: number;
        avgClimb: number;
        skillAverages: Record<string, number>;
        avgSkill: number;
        autonWinRate: number;
        autonContributionRate: number;
        breakdownRate: number;
        fuelConsistency: number;
        matchesScoutedCount: number;
        rank: number | null;
      }[];
    }>(`/api/stats/${encodeURIComponent(eventKey)}${weights ? `?weights=${encodeURIComponent(JSON.stringify(weights))}` : ""}`),

  pickList: () => apiFetch<number[]>("/api/pick-list"),
  setPickList: (teamNumbers: number[]) =>
    apiFetch<{ ok: boolean }>("/api/pick-list", { method: "PUT", body: JSON.stringify({ teamNumbers }) }),

  getSetting: (key: string) => apiFetch<{ key: string; value: string | null }>(`/api/settings/${key}`),
  setSetting: (key: string, value: string) =>
    apiFetch<{ ok: boolean }>(`/api/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),

  joinInfo: (clientPort = "5173") =>
    apiFetch<{ urls: string[]; qrDataUrl: string | null }>(`/api/network/join-info?clientPort=${clientPort}`),
};
