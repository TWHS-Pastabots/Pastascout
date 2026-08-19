import { Router } from "express";
import { config } from "../config.js";
import { getSyncStatus, syncEvent, triggerSyncNow } from "../tba/sync.js";

export const tbaRouter = Router();

// Is a server-side key configured, and when did it last pull?
tbaRouter.get("/status", (_req, res) => {
  res.json(getSyncStatus());
});

// Force an immediate re-pull of the configured event.
tbaRouter.post("/sync-now", async (_req, res) => {
  const status = await triggerSyncNow();
  if (!status.configured) {
    res.status(400).json({ error: "No TBA key configured on the server" });
    return;
  }
  res.json(status);
});

// Manual one-off import. Falls back to the server's configured key when the
// client doesn't supply one, so nobody needs their own TBA account.
tbaRouter.post("/import", async (req, res) => {
  const { eventKey, apiKey } = req.body as { eventKey?: string; apiKey?: string };
  const key = apiKey?.trim() || config.tba.apiKey;

  if (!eventKey) {
    res.status(400).json({ error: "eventKey is required" });
    return;
  }
  if (!key) {
    res.status(400).json({ error: "No TBA API key provided or configured on the server" });
    return;
  }

  try {
    const result = await syncEvent(eventKey, key);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "TBA import failed" });
  }
});
