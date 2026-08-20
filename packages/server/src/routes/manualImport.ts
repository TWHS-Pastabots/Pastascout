import { Router } from "express";
import { parseMatchSchedule, parseTeamList } from "@frc-scout/shared";
import { eventsRepo, teamsRepo, matchesRepo } from "../db/repositories.js";
import { broadcast } from "../ws.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const manualImportRouter = Router();

/**
 * Sets up an event from pasted text — no TBA key or account required.
 * Body: { eventKey, eventName, teamsText?, scheduleText? }
 */
manualImportRouter.post(
  "/event",
  asyncHandler(async (req, res) => {
    const { eventKey, eventName, teamsText, scheduleText } = req.body as {
      eventKey?: string;
      eventName?: string;
      teamsText?: string;
      scheduleText?: string;
    };

    if (!eventKey?.trim()) {
      res.status(400).json({ error: "eventKey is required" });
      return;
    }
    const key = eventKey.trim();

    await eventsRepo.upsert({ eventKey: key, name: eventName?.trim() || key });

    const teamResult = teamsText?.trim() ? parseTeamList(teamsText) : { rows: [], issues: [] };
    const scheduleResult = scheduleText?.trim() ? parseMatchSchedule(scheduleText) : { rows: [], issues: [] };

    for (const team of teamResult.rows) {
      await teamsRepo.upsert({ teamNumber: team.teamNumber, name: team.name });
    }

    // Any team that appears in the schedule but wasn't in the team list still
    // needs a row, or the dashboard can't label it. Only teams we've never seen
    // get a placeholder name — importing a schedule must never clobber real
    // nicknames that were loaded earlier.
    const alreadyStored = new Set((await teamsRepo.all()).map((t) => t.teamNumber));
    const knownTeams = new Set([...alreadyStored, ...teamResult.rows.map((t) => t.teamNumber)]);
    for (const match of scheduleResult.rows) {
      for (const teamNumber of [...match.redTeams, ...match.blueTeams]) {
        if (!knownTeams.has(teamNumber)) {
          knownTeams.add(teamNumber);
          await teamsRepo.upsert({ teamNumber, name: `Team ${teamNumber}` });
        }
      }
    }

    for (const match of scheduleResult.rows) {
      // "qm"/"pm" mirrors TBA's own short codes for qual/playoff matches, so
      // IDs stay stable if the same event is later synced from TBA directly.
      const levelCode = match.type === "qual" ? "qm" : "pm";
      await matchesRepo.upsert({
        id: `${key}_${levelCode}${match.matchNumber}`,
        eventKey: key,
        matchKey: `${levelCode}${match.matchNumber}`,
        type: match.type,
        matchNumber: match.matchNumber,
        redTeams: match.redTeams,
        blueTeams: match.blueTeams,
        redScore: match.redScore,
        blueScore: match.blueScore,
      });
    }

    broadcast("tba-import-complete", {
      eventKey: key,
      teamCount: knownTeams.size,
      matchCount: scheduleResult.rows.length,
    });

    res.json({
      ok: true,
      eventKey: key,
      teamCount: knownTeams.size,
      matchCount: scheduleResult.rows.length,
      issues: [...teamResult.issues, ...scheduleResult.issues],
    });
  })
);

/**
 * Records official alliance scores for played matches so OPR/EPA can be computed
 * without TBA. Body: { eventKey, results: [{ matchNumber, redScore, blueScore }] }
 */
manualImportRouter.post(
  "/results",
  asyncHandler(async (req, res) => {
    const { eventKey, results } = req.body as {
      eventKey?: string;
      results?: { matchNumber: number; redScore: number; blueScore: number }[];
    };

    if (!eventKey?.trim() || !Array.isArray(results)) {
      res.status(400).json({ error: "eventKey and results[] are required" });
      return;
    }

    const existing = new Map((await matchesRepo.byEvent(eventKey.trim())).map((m) => [m.matchNumber, m]));
    let updated = 0;
    const missing: number[] = [];

    for (const r of results) {
      const match = existing.get(r.matchNumber);
      if (!match) {
        missing.push(r.matchNumber);
        continue;
      }
      await matchesRepo.upsert({ ...match, redScore: r.redScore, blueScore: r.blueScore });
      updated += 1;
    }

    broadcast("match-results-updated", { eventKey, updated });
    res.json({ ok: true, updated, missingMatchNumbers: missing });
  })
);
