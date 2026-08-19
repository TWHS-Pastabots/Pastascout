import { Router } from "express";
import { PitScoutingEntrySchema } from "@frc-scout/shared";
import { pitScoutingRepo } from "../db/repositories.js";
import { broadcast } from "../ws.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const pitScoutingRouter = Router();

pitScoutingRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { teamNumber } = req.query as { teamNumber?: string };
    let rows = await pitScoutingRepo.all();
    if (teamNumber) rows = rows.filter((r) => r.teamNumber === Number(teamNumber));
    res.json(rows);
  })
);

pitScoutingRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = PitScoutingEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const entry = parsed.data;
    await pitScoutingRepo.upsert(entry);

    broadcast("pit-scouting-updated", { id: entry.id, teamNumber: entry.teamNumber });
    res.status(201).json({ ok: true, id: entry.id });
  })
);
