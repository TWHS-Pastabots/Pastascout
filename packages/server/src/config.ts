import { existsSync } from "node:fs";

// Load packages/server/.env if present (Node's built-in loader — no dotenv dep).
// Config lives server-side so one person sets the TBA key once for the whole
// team, and scouts never see it or need an account of their own.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export const config = {
  port: Number(process.env.PORT ?? 5174),
  dbPath: process.env.DB_PATH ?? "./data/scouting.db",
  turso: {
    url: process.env.TURSO_DATABASE_URL?.trim() || null,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim() || null,
  },
  tba: {
    apiKey: process.env.TBA_API_KEY?.trim() || null,
    /** Event to keep in sync automatically, e.g. "2026caav". */
    eventKey: process.env.TBA_EVENT_KEY?.trim() || null,
    /** How often to re-pull the event (schedule + results) in minutes. */
    syncIntervalMinutes: Number(process.env.TBA_SYNC_INTERVAL_MINUTES ?? 3),
  },
};

export function isTbaConfigured(): boolean {
  return Boolean(config.tba.apiKey && config.tba.eventKey);
}

/**
 * When set, the server persists to a hosted Turso (libSQL) database instead of
 * the local SQLite file — for a cloud deployment where the local disk isn't
 * guaranteed to survive a restart. Unset (the default) keeps the original
 * local-file mode, which is what the laptop-at-a-competition, no-internet
 * setup depends on.
 */
export function isTursoConfigured(): boolean {
  return Boolean(config.turso.url && config.turso.authToken);
}
