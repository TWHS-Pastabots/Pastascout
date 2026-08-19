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
      await client.executeMultiple(sql);
    },
  };
}
