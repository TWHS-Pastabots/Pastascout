import { Router } from "express";
import { MatchScoutingEntrySchema } from "@frc-scout/shared";
import { matchScoutingRepo } from "../db/repositories.js";
import { broadcast } from "../ws.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

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
