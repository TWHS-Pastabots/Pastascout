import { createClient } from "@libsql/client";
import type { DbAdapter } from "./adapter.js";

/** Hosted backend — used for a cloud deployment where local disk isn't persistent. */
export function createTursoAdapter(url: string, authToken: string): DbAdapter {
  const client = createClient({ url, authToken });

  return {
    async all(sql, params = []) {
      const res = await client.execute({ sql, args: params as never[] });
      return res.rows.map((r) => ({ ...r })) as never;
    },
    async get(sql, params = []) {
      const res = await client.execute({ sql, args: params as never[] });
      return res.rows[0] ? ({ ...res.rows[0] } as never) : undefined;
    },
    async run(sql, params = []) {
      await client.execute({ sql, args: params as never[] });
    },
    async execMulti(sql) {
      // executeMultiple() sends the whole semicolon-separated block as one
      // request, which only works reliably over the WebSocket transport.
      // Some hosts (e.g. Render) block outbound WebSocket, so the client
      // falls back to plain HTTP — and that transport 400s on it. batch()
      // is the transport-agnostic way to run multiple statements, so split
      // the DDL into individual statements and run it that way instead.
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (statements.length > 0) await client.batch(statements, "write");
    },
  };
}
