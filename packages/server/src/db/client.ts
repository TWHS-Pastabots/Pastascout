import { config, isTursoConfigured } from "../config.js";
import type { DbAdapter } from "./adapter.js";
import { createSqliteAdapter } from "./sqliteAdapter.js";
import { createTursoAdapter } from "./tursoAdapter.js";

export const db: DbAdapter = isTursoConfigured()
  ? createTursoAdapter(config.turso.url!, config.turso.authToken!)
  : createSqliteAdapter(config.dbPath);

if (isTursoConfigured()) {
  console.log("[db] using Turso (hosted) — TURSO_DATABASE_URL is set");
} else {
  console.log(`[db] using local SQLite file at ${config.dbPath}`);
}

export async function ensureSchema() {
  await db.execMulti(`
    CREATE TABLE IF NOT EXISTS events (
      event_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT
    );

    CREATE TABLE IF NOT EXISTS teams (
      team_number INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      tba_key TEXT
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      event_key TEXT NOT NULL,
      match_key TEXT NOT NULL,
      type TEXT NOT NULL,
      match_number INTEGER NOT NULL,
      red_teams TEXT NOT NULL,
      blue_teams TEXT NOT NULL,
      scheduled_time TEXT,
      red_score INTEGER,
      blue_score INTEGER
    );

    CREATE TABLE IF NOT EXISTS match_scouting_entries (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      alliance TEXT NOT NULL,
      scout_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      auton TEXT NOT NULL,
      teleop TEXT NOT NULL,
      auton_path TEXT NOT NULL,
      skill_ratings TEXT NOT NULL,
      penalties INTEGER NOT NULL DEFAULT 0,
      broke_down INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS pit_scouting_entries (
      id TEXT PRIMARY KEY,
      team_number INTEGER NOT NULL,
      scout_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      drivetrain_type TEXT NOT NULL DEFAULT '',
      weight_lbs REAL,
      auton_capabilities TEXT NOT NULL DEFAULT '',
      can_climb_levels TEXT NOT NULL DEFAULT '[]',
      can_go_under_trench INTEGER NOT NULL DEFAULT 0,
      fuel_capacity INTEGER,
      photos TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS pick_list_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_number INTEGER NOT NULL,
      position INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_match_scouting_match ON match_scouting_entries(match_id);
    CREATE INDEX IF NOT EXISTS idx_match_scouting_scout ON match_scouting_entries(scout_name);
    CREATE INDEX IF NOT EXISTS idx_match_scouting_team ON match_scouting_entries(team_number);
    CREATE INDEX IF NOT EXISTS idx_pit_scouting_team ON pit_scouting_entries(team_number);
    CREATE INDEX IF NOT EXISTS idx_matches_event ON matches(event_key);
  `);

  await migrateColumns();
}

/**
 * CREATE TABLE IF NOT EXISTS only helps on a fresh database — it does nothing
 * for a table that already exists from before a field was added. This adds
 * any missing columns to an existing database in place (local file or Turso),
 * so upgrading the app never requires deleting scouting data already collected.
 */
async function migrateColumns() {
  const existingColumns = new Set(
    (await db.all<{ name: string }>("PRAGMA table_info(pit_scouting_entries)")).map((c) => c.name)
  );
  const wanted: [string, string][] = [
    ["can_go_under_trench", "INTEGER NOT NULL DEFAULT 0"],
    ["fuel_capacity", "INTEGER"],
    ["photos", "TEXT NOT NULL DEFAULT '[]'"],
  ];
  for (const [name, definition] of wanted) {
    if (!existingColumns.has(name)) {
      await db.run(`ALTER TABLE pit_scouting_entries ADD COLUMN ${name} ${definition}`);
    }
  }
}
