import { eventsRepo, teamsRepo, matchesRepo } from "../db/repositories.js";
import { fetchEvent, fetchEventTeams, fetchEventMatches } from "./client.js";
import { broadcast } from "../ws.js";
import { config, isTbaConfigured } from "../config.js";

export interface SyncStatus {
  configured: boolean;
  eventKey: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  teamCount: number;
  matchCount: number;
  syncing: boolean;
}

const status: SyncStatus = {
  configured: false,
  eventKey: null,
  lastSyncAt: null,
  lastError: null,
  teamCount: 0,
  matchCount: 0,
  syncing: false,
};

export function getSyncStatus(): SyncStatus {
  return { ...status, configured: isTbaConfigured(), eventKey: config.tba.eventKey };
}

/**
 * Pulls an event's teams, schedule, and results from TBA into the local DB.
 * Shared by the automatic background sync and the manual import endpoint.
 */
export async function syncEvent(eventKey: string, apiKey: string) {
  const [event, tbaTeams, tbaMatches] = await Promise.all([
    fetchEvent(eventKey, apiKey),
    fetchEventTeams(eventKey, apiKey),
    fetchEventMatches(eventKey, apiKey),
  ]);

  await eventsRepo.upsert(event);
  for (const team of tbaTeams) await teamsRepo.upsert(team);
  for (const match of tbaMatches) await matchesRepo.upsert(match);

  broadcast("tba-import-complete", {
    eventKey,
    teamCount: tbaTeams.length,
    matchCount: tbaMatches.length,
  });

  return { teamCount: tbaTeams.length, matchCount: tbaMatches.length };
}

async function runAutoSync() {
  if (!isTbaConfigured() || status.syncing) return;
  status.syncing = true;
  try {
    const result = await syncEvent(config.tba.eventKey!, config.tba.apiKey!);
    status.teamCount = result.teamCount;
    status.matchCount = result.matchCount;
    status.lastSyncAt = new Date().toISOString();
    status.lastError = null;
    console.log(
      `[tba] synced ${config.tba.eventKey}: ${result.teamCount} teams, ${result.matchCount} matches`
    );
  } catch (err) {
    status.lastError = err instanceof Error ? err.message : String(err);
    // Non-fatal: at a venue the internet often drops. Whatever was pulled last
    // time is still in the DB and still served to clients.
    console.warn(`[tba] sync failed: ${status.lastError}`);
  } finally {
    status.syncing = false;
    broadcast("tba-sync-status", getSyncStatus());
  }
}

/** Starts background syncing if a key + event are configured. Safe to call when they aren't. */
export function startAutoSync() {
  if (!isTbaConfigured()) {
    console.log("[tba] no TBA_API_KEY/TBA_EVENT_KEY set — auto-sync off (manual import still available)");
    return;
  }
  const intervalMs = Math.max(1, config.tba.syncIntervalMinutes) * 60_000;
  console.log(
    `[tba] auto-sync on for ${config.tba.eventKey} every ${config.tba.syncIntervalMinutes} min`
  );
  runAutoSync();
  setInterval(runAutoSync, intervalMs);
}

/** Triggers an immediate sync (used by the "Refresh now" button). */
export async function triggerSyncNow() {
  await runAutoSync();
  return getSyncStatus();
}
