import type { RequestHandler } from "express";
import { config, isAnalystAuthConfigured } from "../config.js";
import { isValidAnalystToken } from "../auth.js";

/**
 * Gates the Analyst-only endpoints behind ANALYST_PASSWORD. When that env var
 * isn't set, this is a no-op — auth is opt-in, matching how TBA/Turso config
 * works elsewhere: unset means "not using this feature," not "broken."
 */
export const requireAnalystAuth: RequestHandler = (req, res, next) => {
  if (!isAnalystAuthConfigured()) {
    next();
    return;
  }
  const token = req.header("X-Analyst-Token");
  if (!isValidAnalystToken(token)) {
    res.status(401).json({ error: "Analyst login required" });
    return;
  }
  next();
};

// Exported for the login route to check the password directly.
export function checkAnalystPassword(password: string): boolean {
  return isAnalystAuthConfigured() && password === config.analystPassword;
}
