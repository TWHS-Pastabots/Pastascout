import { Router } from "express";
import { matchesRepo } from "../db/repositories.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const matchesRouter = Router();

matchesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const eventKey = req.query.eventKey as string | undefined;
    const rows = eventKey ? await matchesRepo.byEvent(eventKey) : await matchesRepo.all();
    rows.sort((a, b) => a.matchNumber - b.matchNumber);
    res.json(rows);
  })
);
