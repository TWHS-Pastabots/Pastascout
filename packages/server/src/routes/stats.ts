import { Router } from "express";
import { computeOPR, computeEPA, computeBlendedRank, type AllianceMatchResult } from "@frc-scout/shared";
import { matchesRepo, matchScoutingRepo, teamsRepo } from "../db/repositories.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const statsRouter = Router();

const DEFAULT_WEIGHTS: Record<string, number> = {
  epa: 0.45,
  opr: 0.25,
  avgFuel: 0.15,
  avgSkill: 0.15,
};

statsRouter.get(
  "/:eventKey",
  asyncHandler(async (req, res) => {
    const { eventKey } = req.params;
    let weights = DEFAULT_WEIGHTS;
    if (typeof req.query.weights === "string") {
      try {
        weights = { ...DEFAULT_WEIGHTS, ...JSON.parse(req.query.weights) };
      } catch {
        // fall back to defaults on bad JSON
      }
    }

    const eventMatches = await matchesRepo.byEvent(eventKey);
    const playedMatches = eventMatches.filter((m) => m.redScore != null && m.blueScore != null);

    const allianceResults: AllianceMatchResult[] = playedMatches.flatMap((m) => [
      { matchKey: m.matchKey, teams: m.redTeams, score: m.redScore!, order: m.matchNumber },
      { matchKey: m.matchKey, teams: m.blueTeams, score: m.blueScore!, order: m.matchNumber },
    ]);
    const teamNumbers = [...new Set(eventMatches.flatMap((m) => [...m.redTeams, ...m.blueTeams]))];

    const opr = computeOPR(allianceResults, teamNumbers);
    const epa = computeEPA(allianceResults, teamNumbers, { learningRate: 0.3, passes: 3 });

    const matchIdsInEvent = new Set(eventMatches.map((m) => m.id));
    const scoutingEntries = (await matchScoutingRepo.all()).filter((e) => matchIdsInEvent.has(e.matchId));

    const teamNames = new Map((await teamsRepo.all()).map((t) => [t.teamNumber, t.name]));

    const perTeamScouting = new Map<
      number,
      {
        fuelTotal: number;
        climbTotal: number;
        entryCount: number;
        autonWins: number;
        autonContributions: number;
        breakdowns: number;
        fuelValues: number[];
        skillSums: Record<string, number>;
        skillCounts: Record<string, number>;
      }
    >();
    for (const e of scoutingEntries) {
      const bucket = perTeamScouting.get(e.teamNumber) ?? {
        fuelTotal: 0,
        climbTotal: 0,
        entryCount: 0,
        autonWins: 0,
        autonContributions: 0,
        breakdowns: 0,
        fuelValues: [],
        skillSums: {},
        skillCounts: {},
      };
      const matchFuel = e.auton.fuelScored + e.teleop.fuelScored;
      bucket.fuelTotal += matchFuel;
      bucket.fuelValues.push(matchFuel);
      bucket.climbTotal += e.teleop.towerClimbLevel;
      bucket.entryCount += 1;
      if (e.auton.wonAuton) bucket.autonWins += 1;
      if (e.auton.contributedToAuton) bucket.autonContributions += 1;
      if (e.brokeDown) bucket.breakdowns += 1;
      for (const rating of e.skillRatings) {
        bucket.skillSums[rating.categoryId] = (bucket.skillSums[rating.categoryId] ?? 0) + rating.score;
        bucket.skillCounts[rating.categoryId] = (bucket.skillCounts[rating.categoryId] ?? 0) + 1;
      }
      perTeamScouting.set(e.teamNumber, bucket);
    }

    const teamStats = teamNumbers.map((teamNumber) => {
      const scouting = perTeamScouting.get(teamNumber);
      const avgFuel = scouting && scouting.entryCount > 0 ? scouting.fuelTotal / scouting.entryCount : 0;
      const avgClimb = scouting && scouting.entryCount > 0 ? scouting.climbTotal / scouting.entryCount : 0;
      const skillAverages: Record<string, number> = {};
      if (scouting) {
        for (const categoryId of Object.keys(scouting.skillSums)) {
          skillAverages[categoryId] = scouting.skillSums[categoryId] / scouting.skillCounts[categoryId];
        }
      }
      const skillValues = Object.values(skillAverages);
      const avgSkill = skillValues.length > 0 ? skillValues.reduce((a, b) => a + b, 0) / skillValues.length : 0;

      const entryCount = scouting?.entryCount ?? 0;

      // Consistency via coefficient of variation, mapped to 0-1 so a steady
      // scorer beats a boom-or-bust one when picks are otherwise equal.
      let fuelConsistency = 0;
      if (scouting && entryCount > 1 && avgFuel > 0) {
        const variance =
          scouting.fuelValues.reduce((sum, v) => sum + (v - avgFuel) ** 2, 0) / scouting.fuelValues.length;
        fuelConsistency = 1 / (1 + Math.sqrt(variance) / avgFuel);
      } else if (entryCount === 1) {
        fuelConsistency = 0.5; // one match tells us nothing about variance
      }

      return {
        teamNumber,
        teamName: teamNames.get(teamNumber) ?? `Team ${teamNumber}`,
        opr: opr.get(teamNumber) ?? 0,
        epa: epa.get(teamNumber) ?? 0,
        avgFuel,
        avgClimb,
        skillAverages,
        avgSkill,
        autonWinRate: entryCount > 0 ? (scouting!.autonWins / entryCount) * 100 : 0,
        autonContributionRate: entryCount > 0 ? (scouting!.autonContributions / entryCount) * 100 : 0,
        breakdownRate: entryCount > 0 ? scouting!.breakdowns / entryCount : 0,
        fuelConsistency,
        matchesScoutedCount: entryCount,
      };
    });

    const blendedRank = computeBlendedRank(
      teamStats.map((t) => ({
        teamNumber: t.teamNumber,
        metrics: { epa: t.epa, opr: t.opr, avgFuel: t.avgFuel, avgSkill: t.avgSkill },
      })),
      weights
    );
    const rankIndex = new Map(blendedRank.map((r, i) => [r.teamNumber, i + 1]));

    const result = teamStats
      .map((t) => ({ ...t, rank: rankIndex.get(t.teamNumber) ?? null }))
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

    res.json({ eventKey, weights, teams: result, matchesPlayed: playedMatches.length });
  })
);
