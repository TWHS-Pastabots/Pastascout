/**
 * A tiny async interface over either backend, so the rest of the server never
 * has to know whether it's talking to a local SQLite file or a hosted Turso
 * database. Both are SQLite dialect underneath, so one query layer works for
 * both — only the driver differs.
 */
export interface DbAdapter {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<void>;
  /** Runs a semicolon-separated block of DDL statements with no bound params. */
  execMulti(sql: string): Promise<void>;
}
