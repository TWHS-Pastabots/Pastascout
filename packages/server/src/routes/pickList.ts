import { Router } from "express";
import { pickListRepo } from "../db/repositories.js";
import { broadcast } from "../ws.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const pickListRouter = Router();

pickListRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await pickListRepo.all());
  })
);

// PUT /api/pick-list  { teamNumbers: number[] } — replaces the whole ordered list.
// Shared across every analyst laptop; broadcasts so open dashboards update live.
pickListRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const { teamNumbers } = req.body as { teamNumbers?: number[] };
    if (!Array.isArray(teamNumbers)) {
      res.status(400).json({ error: "teamNumbers must be an array" });
      return;
    }

    await pickListRepo.replace(teamNumbers);
    broadcast("pick-list-updated", { teamNumbers });
    res.json({ ok: true, teamNumbers });
  })
);
