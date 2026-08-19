import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DbAdapter } from "./adapter.js";

/** Local-file backend — used at a competition where there's no internet at all. */
export function createSqliteAdapter(dbPath: string): DbAdapter {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");

  return {
    async all(sql, params = []) {
      return db.prepare(sql).all(...(params as never[])) as never;
    },
    async get(sql, params = []) {
      return db.prepare(sql).get(...(params as never[])) as never;
    },
    async run(sql, params = []) {
      db.prepare(sql).run(...(params as never[]));
    },
    async execMulti(sql) {
      db.exec(sql);
    },
  };
}
