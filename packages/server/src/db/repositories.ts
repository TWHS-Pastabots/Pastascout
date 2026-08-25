import { db } from "./client.js";
import type { MatchScoutingEntry, PitScoutingEntry } from "@frc-scout/shared";

// Thin repositories over the DB adapter — keeps raw SQL and JSON
// (de)serialization for TEXT columns in one place instead of scattered across
// route handlers. All async: the Turso backend is a network call per query,
// even though the local SQLite backend resolves synchronously under the hood.

export interface EventRow {
  eventKey: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

export const eventsRepo = {
  async all(): Promise<EventRow[]> {
    return (await db.all("SELECT * FROM events")).map(rowToEvent);
  },
  async upsert(e: EventRow) {
    await db.run(
      `INSERT INTO events (event_key, name, start_date, end_date) VALUES (?, ?, ?, ?)
       ON CONFLICT(event_key) DO UPDATE SET name=excluded.name, start_date=excluded.start_date, end_date=excluded.end_date`,
      [e.eventKey, e.name, e.startDate ?? null, e.endDate ?? null]
    );
  },
};
function rowToEvent(r: any): EventRow {
  return { eventKey: r.event_key, name: r.name, startDate: r.start_date ?? undefined, endDate: r.end_date ?? undefined };
}

export interface TeamRow {
  teamNumber: number;
  name: string;
  tbaKey?: string;
}

export const teamsRepo = {
  async all(): Promise<TeamRow[]> {
    return (await db.all("SELECT * FROM teams")).map(rowToTeam);
  },
  async upsert(t: TeamRow) {
    await db.run(
      `INSERT INTO teams (team_number, name, tba_key) VALUES (?, ?, ?)
       ON CONFLICT(team_number) DO UPDATE SET name=excluded.name, tba_key=excluded.tba_key`,
      [t.teamNumber, t.name, t.tbaKey ?? null]
    );
  },
};
function rowToTeam(r: any): TeamRow {
  return { teamNumber: r.team_number, name: r.name, tbaKey: r.tba_key ?? undefined };
}

export interface MatchRow {
  id: string;
  eventKey: string;
  matchKey: string;
  type: "qual" | "playoff";
  matchNumber: number;
  redTeams: number[];
  blueTeams: number[];
  scheduledTime?: string;
  redScore?: number;
  blueScore?: number;
}

export const matchesRepo = {
  async all(): Promise<MatchRow[]> {
    return (await db.all("SELECT * FROM matches")).map(rowToMatch);
  },
  async byEvent(eventKey: string): Promise<MatchRow[]> {
    return (await db.all("SELECT * FROM matches WHERE event_key = ?", [eventKey])).map(rowToMatch);
  },
  async upsert(m: MatchRow) {
    await db.run(
      `INSERT INTO matches (id, event_key, match_key, type, match_number, red_teams, blue_teams, scheduled_time, red_score, blue_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET event_key=excluded.event_key, match_key=excluded.match_key, type=excluded.type,
         match_number=excluded.match_number, red_teams=excluded.red_teams, blue_teams=excluded.blue_teams,
         scheduled_time=excluded.scheduled_time, red_score=excluded.red_score, blue_score=excluded.blue_score`,
      [
        m.id,
        m.eventKey,
        m.matchKey,
        m.type,
        m.matchNumber,
        JSON.stringify(m.redTeams),
        JSON.stringify(m.blueTeams),
        m.scheduledTime ?? null,
        m.redScore ?? null,
        m.blueScore ?? null,
      ]
    );
  },
};
function rowToMatch(r: any): MatchRow {
  return {
    id: r.id,
    eventKey: r.event_key,
    matchKey: r.match_key,
    type: r.type,
    matchNumber: r.match_number,
    redTeams: JSON.parse(r.red_teams),
    blueTeams: JSON.parse(r.blue_teams),
    scheduledTime: r.scheduled_time ?? undefined,
    redScore: r.red_score ?? undefined,
    blueScore: r.blue_score ?? undefined,
  };
}

export const matchScoutingRepo = {
  async all(): Promise<MatchScoutingEntry[]> {
    return (await db.all("SELECT * FROM match_scouting_entries")).map(rowToMatchScouting);
  },
  async upsert(e: MatchScoutingEntry) {
    await db.run(
      `INSERT INTO match_scouting_entries
         (id, match_id, team_number, alliance, scout_name, created_at, auton, teleop, auton_path, skill_ratings, penalties, broke_down, notes, exclude_from_stats)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         match_id=excluded.match_id, team_number=excluded.team_number, alliance=excluded.alliance,
         scout_name=excluded.scout_name, auton=excluded.auton, teleop=excluded.teleop,
         auton_path=excluded.auton_path, skill_ratings=excluded.skill_ratings,
         penalties=excluded.penalties, broke_down=excluded.broke_down, notes=excluded.notes,
         exclude_from_stats=excluded.exclude_from_stats`,
      [
        e.id,
        e.matchId,
        e.teamNumber,
        e.alliance,
        e.scoutName,
        e.createdAt,
        JSON.stringify(e.auton),
        JSON.stringify(e.teleop),
        JSON.stringify(e.autonPath),
        JSON.stringify(e.skillRatings),
        e.penalties,
        e.brokeDown ? 1 : 0,
        e.notes,
        e.excludeFromStats ? 1 : 0,
      ]
    );
  },
};
function rowToMatchScouting(r: any): MatchScoutingEntry {
  return {
    id: r.id,
    matchId: r.match_id,
    teamNumber: r.team_number,
    alliance: r.alliance,
    scoutName: r.scout_name,
    createdAt: r.created_at,
    auton: JSON.parse(r.auton),
    teleop: JSON.parse(r.teleop),
    autonPath: JSON.parse(r.auton_path),
    skillRatings: JSON.parse(r.skill_ratings),
    penalties: r.penalties,
    brokeDown: !!r.broke_down,
    notes: r.notes,
    excludeFromStats: !!r.exclude_from_stats,
  };
}

export const pitScoutingRepo = {
  async all(): Promise<PitScoutingEntry[]> {
    return (await db.all("SELECT * FROM pit_scouting_entries")).map(rowToPitScouting);
  },
  async upsert(e: PitScoutingEntry) {
    await db.run(
      `INSERT INTO pit_scouting_entries
         (id, team_number, scout_name, created_at, drivetrain_type, weight_lbs, auton_capabilities, can_climb_levels, can_go_under_trench, fuel_capacity, photos, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         team_number=excluded.team_number, scout_name=excluded.scout_name, drivetrain_type=excluded.drivetrain_type,
         weight_lbs=excluded.weight_lbs, auton_capabilities=excluded.auton_capabilities,
         can_climb_levels=excluded.can_climb_levels, can_go_under_trench=excluded.can_go_under_trench,
         fuel_capacity=excluded.fuel_capacity, photos=excluded.photos, notes=excluded.notes`,
      [
        e.id,
        e.teamNumber,
        e.scoutName,
        e.createdAt,
        e.drivetrainType,
        e.weightLbs ?? null,
        e.autonCapabilities,
        JSON.stringify(e.canClimbLevels),
        e.canGoUnderTrench ? 1 : 0,
        e.fuelCapacity ?? null,
        JSON.stringify(e.photos ?? []),
        e.notes,
      ]
    );
  },
};
function rowToPitScouting(r: any): PitScoutingEntry {
  return {
    id: r.id,
    teamNumber: r.team_number,
    scoutName: r.scout_name,
    createdAt: r.created_at,
    drivetrainType: r.drivetrain_type,
    weightLbs: r.weight_lbs ?? undefined,
    autonCapabilities: r.auton_capabilities,
    canClimbLevels: JSON.parse(r.can_climb_levels),
    canGoUnderTrench: !!r.can_go_under_trench,
    fuelCapacity: r.fuel_capacity ?? undefined,
    photos: JSON.parse(r.photos ?? "[]"),
    notes: r.notes,
  };
}

export const pickListRepo = {
  async all(): Promise<number[]> {
    const rows = await db.all<{ team_number: number }>(
      "SELECT team_number FROM pick_list_entries ORDER BY position ASC"
    );
    return rows.map((r) => r.team_number);
  },
  async replace(teamNumbers: number[]) {
    const now = new Date().toISOString();
    await db.run("DELETE FROM pick_list_entries");
    for (const [index, teamNumber] of teamNumbers.entries()) {
      await db.run("INSERT INTO pick_list_entries (team_number, position, updated_at) VALUES (?, ?, ?)", [
        teamNumber,
        index,
        now,
      ]);
    }
  },
};

export const settingsRepo = {
  async get(key: string): Promise<string | null> {
    const row = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
    return row?.value ?? null;
  },
  async set(key: string, value: string) {
    await db.run(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [key, value]
    );
  },
};
