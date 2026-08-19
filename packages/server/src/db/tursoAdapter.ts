import { createClient } from "@libsql/client";
import type { DbAdapter } from "./adapter.js";

/**
 * Wraps fetch to log the raw response on failure — @libsql/client's own error
 * only surfaces "HTTP status 400" with no body, which isn't enough to tell a
 * protobuf/network-transport problem from a real SQL rejection. Logs, then
 * re-throws unchanged so behavior is otherwise identical to plain fetch.
 */
const diagnosticFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (!res.ok) {
    const cloned = res.clone();
    const bodyText = await cloned.text().catch(() => "<unreadable body>");
    console.error(
      `[turso] HTTP ${res.status} from ${String(input)} — content-type: ${res.headers.get("content-type")} — body: ${bodyText.slice(0, 500)}`
    );
  }
  return res;
};

/** Hosted backend — used for a cloud deployment where local disk isn't persistent. */
export function createTursoAdapter(url: string, authToken: string): DbAdapter {
  const client = createClient({ url, authToken, fetch: diagnosticFetch });

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
      // Run one statement per request rather than executeMultiple() or
      // batch() (both send several statements in a single HTTP call). This
      // is slower, but for one-time schema setup that's irrelevant — and it
      // means a failure names the exact statement responsible instead of
      // failing the whole block opaquely.
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const [i, statement] of statements.entries()) {
        try {
          await client.execute(statement);
        } catch (err) {
          console.error(`[turso] schema statement ${i + 1}/${statements.length} failed: ${statement}`);
          throw err;
        }
      }
    },
  };
}
