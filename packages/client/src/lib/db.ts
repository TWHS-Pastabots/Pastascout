import Dexie, { type Table } from "dexie";
import type { Match, MatchScoutingEntry, PitScoutingEntry } from "@frc-scout/shared";

export interface OutboxRecord<T> {
  id: string; // matches entry.id — the upsert key on the server too
  payload: T;
  synced: number; // 0 | 1 — Dexie indexes don't like booleans
  createdAt: string;
  lastError?: string;
  attempts: number;
}

export interface CachedTeam {
  teamNumber: number;
  name: string;
  tbaKey?: string;
}

class ScoutingDB extends Dexie {
  matchScoutingOutbox!: Table<OutboxRecord<MatchScoutingEntry>, string>;
  pitScoutingOutbox!: Table<OutboxRecord<PitScoutingEntry>, string>;
  // Read-through cache of server data so scouts can browse the schedule/teams fully offline.
  cachedMatches!: Table<Match, string>;
  cachedTeams!: Table<CachedTeam, number>;

  constructor() {
    super("frc-scouting");
    this.version(1).stores({
      matchScoutingOutbox: "id, synced",
      pitScoutingOutbox: "id, synced",
      cachedMatches: "id, eventKey, matchNumber",
      cachedTeams: "teamNumber",
    });
  }
}

export const db = new ScoutingDB();

export async function queueMatchScouting(entry: MatchScoutingEntry) {
  await db.matchScoutingOutbox.put({ id: entry.id, payload: entry, synced: 0, createdAt: entry.createdAt, attempts: 0 });
}

export async function queuePitScouting(entry: PitScoutingEntry) {
  await db.pitScoutingOutbox.put({ id: entry.id, payload: entry, synced: 0, createdAt: entry.createdAt, attempts: 0 });
}

export async function cacheMatches(matches: Match[]) {
  await db.cachedMatches.bulkPut(matches);
}

export async function cacheTeams(teams: CachedTeam[]) {
  await db.cachedTeams.bulkPut(teams);
}
