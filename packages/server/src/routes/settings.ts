import { Router } from "express";
import { settingsRepo } from "../db/repositories.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/:key",
  asyncHandler(async (req, res) => {
    res.json({ key: req.params.key, value: await settingsRepo.get(req.params.key) });
  })
);

settingsRouter.put(
  "/:key",
  asyncHandler(async (req, res) => {
    const { value } = req.body as { value?: string };
    if (typeof value !== "string") {
      res.status(400).json({ error: "value must be a string" });
      return;
    }
    await settingsRepo.set(req.params.key, value);
    res.json({ ok: true });
  })
);
