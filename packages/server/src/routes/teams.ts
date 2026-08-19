import { Router } from "express";
import { teamsRepo } from "../db/repositories.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const teamsRouter = Router();

teamsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await teamsRepo.all());
  })
);
