import { Router } from "express";
import { eventsRepo } from "../db/repositories.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const eventsRouter = Router();

eventsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await eventsRepo.all());
  })
);
