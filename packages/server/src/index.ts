import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import type { ErrorRequestHandler } from "express";
import { config } from "./config.js";
import { ensureSchema } from "./db/client.js";
import { startAutoSync } from "./tba/sync.js";
import { manualImportRouter } from "./routes/manualImport.js";
import { initWebSocket } from "./ws.js";
import { eventsRouter } from "./routes/events.js";
import { teamsRouter } from "./routes/teams.js";
import { matchesRouter } from "./routes/matches.js";
import { matchScoutingRouter } from "./routes/matchScouting.js";
import { pitScoutingRouter } from "./routes/pitScouting.js";
import { tbaRouter } from "./routes/tba.js";
import { statsRouter } from "./routes/stats.js";
import { pickListRouter } from "./routes/pickList.js";
import { settingsRouter } from "./routes/settings.js";
import { networkRouter } from "./routes/network.js";

async function main() {
  // Must finish before any route touches the DB — the Turso backend in
  // particular needs the schema created over the network before first use.
  await ensureSchema();

  const app = express();
  app.use(cors());
  // Raised from 5mb for pit scouting photos (compressed client-side, but a few
  // per entry as base64 in the JSON body still adds up).
  app.use(express.json({ limit: "15mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/events", eventsRouter);
  app.use("/api/teams", teamsRouter);
  app.use("/api/matches", matchesRouter);
  app.use("/api/match-scouting", matchScoutingRouter);
  app.use("/api/pit-scouting", pitScoutingRouter);
  app.use("/api/tba", tbaRouter);
  app.use("/api/manual", manualImportRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/pick-list", pickListRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/network", networkRouter);

  // Catches anything forwarded via next(err) from asyncHandler — without this,
  // an async route error would otherwise hang the request with no response.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  };
  app.use(onError);

  const server = createServer(app);
  initWebSocket(server);

  server.listen(config.port, "0.0.0.0", () => {
    console.log(`FRC scouting server listening on http://0.0.0.0:${config.port}`);
    // Pulls the configured event from TBA now and on an interval, so the app
    // already has the schedule without anyone running an import by hand.
    startAutoSync();
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
