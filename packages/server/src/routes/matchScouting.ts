import { Router } from "express";
import { z } from "zod";
import { MatchScoutingEntrySchema } from "@frc-scout/shared";
import { matchScoutingRepo } from "../db/repositories.js";
import { broadcast } from "../ws.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAnalystAuth } from "../middleware/requireAnalystAuth.js";

export const matchScoutingRouter = Router();

matchScoutingRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { matchId, teamNumber } = req.query as { matchId?: string; teamNumber?: string };
    let rows = await matchScoutingRepo.all();
    if (matchId) rows = rows.filter((r) => r.matchId === matchId);
    if (teamNumber) rows = rows.filter((r) => r.teamNumber === Number(teamNumber));
    res.json(rows);
  })
);

// Upsert by client-generated UUID — makes retried/duplicate offline-sync POSTs safe.
matchScoutingRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = MatchScoutingEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const entry = parsed.data;
    await matchScoutingRepo.upsert(entry);

    broadcast("match-scouting-updated", { id: entry.id, matchId: entry.matchId, teamNumber: entry.teamNumber });
    res.status(201).json({ ok: true, id: entry.id });
  })
);

const ExcludeBodySchema = z.object({ excludeFromStats: z.boolean() });

// Analyst-only: whether a scout's report should count toward a team's stats.
// Scouts never see this — it's a call for the analyst to make after the fact,
// e.g. once they notice a report looks unreliable.
matchScoutingRouter.patch(
  "/:id/exclude",
  requireAnalystAuth,
  asyncHandler(async (req, res) => {
    const parsed = ExcludeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const updated = await matchScoutingRepo.setExcludeFromStats(req.params.id, parsed.data.excludeFromStats);
    if (!updated) {
      res.status(404).json({ error: "No entry with that id" });
      return;
    }
    broadcast("match-scouting-updated", { id: req.params.id });
    res.json({ ok: true });
  })
);
