import { Router } from "express";
import { isAnalystAuthConfigured } from "../config.js";
import { issueAnalystToken } from "../auth.js";
import { checkAnalystPassword } from "../middleware/requireAnalystAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const authRouter = Router();

// Lets the client know whether to show the password gate at all.
authRouter.get(
  "/analyst-status",
  asyncHandler(async (_req, res) => {
    res.json({ required: isAnalystAuthConfigured() });
  })
);

authRouter.post(
  "/analyst-login",
  asyncHandler(async (req, res) => {
    const { password } = req.body as { password?: string };
    if (!isAnalystAuthConfigured()) {
      res.json({ ok: true, token: null }); // no gate configured — nothing to check
      return;
    }
    if (typeof password !== "string" || !checkAnalystPassword(password)) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    res.json({ ok: true, token: issueAnalystToken() });
  })
);
