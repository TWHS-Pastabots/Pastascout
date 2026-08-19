import { describe, expect, it } from "vitest";
import { hasOfficialResultSignal, suggestPickList, type TeamStatLine } from "./pickList";

function team(overrides: Partial<TeamStatLine> & { teamNumber: number }): TeamStatLine {
  return {
    teamName: `Team ${overrides.teamNumber}`,
    epa: 0,
    opr: 0,
    avgFuel: 0,
    avgClimb: 0,
    avgSkill: 5,
    skillAverages: {},
    autonWinRate: 0,
    autonContributionRate: 0,
    breakdownRate: 0,
    fuelConsistency: 0.5,
    matchesScoutedCount: 5,
    ...overrides,
  };
}

describe("suggestPickList", () => {
  it("ranks the strongest scorer first under the balanced strategy", () => {
    const result = suggestPickList({
      teams: [
        team({ teamNumber: 1, epa: 10, opr: 10, avgFuel: 10 }),
        team({ teamNumber: 2, epa: 90, opr: 85, avgFuel: 90 }),
        team({ teamNumber: 3, epa: 50, opr: 50, avgFuel: 50 }),
      ],
      ourTeamNumber: null,
      strategy: "balanced",
    });
    expect(result[0].teamNumber).toBe(2);
    expect(result[result.length - 1].teamNumber).toBe(1);
  });

  it("never suggests our own team", () => {
    const result = suggestPickList({
      teams: [team({ teamNumber: 1, epa: 99 }), team({ teamNumber: 2, epa: 10 })],
      ourTeamNumber: 1,
      strategy: "balanced",
    });
    expect(result.map((r) => r.teamNumber)).toEqual([2]);
  });

  it("excludes teams already on the pick list", () => {
    const result = suggestPickList({
      teams: [team({ teamNumber: 1 }), team({ teamNumber: 2 }), team({ teamNumber: 3 })],
      ourTeamNumber: null,
      strategy: "balanced",
      excludeTeams: [2],
    });
    expect(result.map((r) => r.teamNumber).sort()).toEqual([1, 3]);
  });

  it("complement strategy prefers a climber when we can't climb", () => {
    // We score fuel well but never climb. Both candidates have equal EPA, so
    // only the capability gap should separate them.
    const teams = [
      team({ teamNumber: 100, epa: 50, avgFuel: 90, avgClimb: 0 }), // us
      team({ teamNumber: 200, epa: 50, avgFuel: 90, avgClimb: 0 }), // another fuel bot
      team({ teamNumber: 300, epa: 50, avgFuel: 10, avgClimb: 3 }), // a climber
    ];

    const result = suggestPickList({ teams, ourTeamNumber: 100, strategy: "complement" });
    expect(result[0].teamNumber).toBe(300);
    expect(result[0].reasons.join(" ")).toContain("endgame climbing");
  });

  it("mirror strategy prefers a team that plays like us", () => {
    const teams = [
      team({ teamNumber: 100, epa: 50, avgFuel: 90, avgClimb: 0 }), // us
      team({ teamNumber: 200, epa: 50, avgFuel: 90, avgClimb: 0 }), // same style
      team({ teamNumber: 300, epa: 50, avgFuel: 10, avgClimb: 3 }), // opposite style
    ];

    const result = suggestPickList({ teams, ourTeamNumber: 100, strategy: "mirror" });
    expect(result[0].teamNumber).toBe(200);
  });

  it("defensive strategy surfaces the best defender over the best scorer", () => {
    const teams = [
      team({ teamNumber: 1, epa: 90, opr: 90, skillAverages: { defense: 1 } }),
      team({ teamNumber: 2, epa: 20, opr: 20, skillAverages: { defense: 10 } }),
    ];
    const result = suggestPickList({ teams, ourTeamNumber: null, strategy: "defensive" });
    expect(result[0].teamNumber).toBe(2);
    expect(result[0].reasons.join(" ")).toContain("defense");
  });

  it("warns about thin scouting data and unreliable robots", () => {
    const result = suggestPickList({
      teams: [
        team({ teamNumber: 1, matchesScoutedCount: 1 }),
        team({ teamNumber: 2, matchesScoutedCount: 0 }),
        team({ teamNumber: 3, breakdownRate: 0.5 }),
      ],
      ourTeamNumber: null,
      strategy: "balanced",
    });

    const byTeam = new Map(result.map((r) => [r.teamNumber, r]));
    expect(byTeam.get(1)!.warnings[0]).toContain("Only 1 match");
    expect(byTeam.get(2)!.warnings[0]).toContain("No scouting data");
    expect(byTeam.get(3)!.warnings[0]).toContain("Broke down in 50%");
  });

  it("penalizes an unreliable robot against an identical reliable one", () => {
    const result = suggestPickList({
      teams: [
        team({ teamNumber: 1, epa: 50, opr: 50, breakdownRate: 0 }),
        team({ teamNumber: 2, epa: 50, opr: 50, breakdownRate: 0.8 }),
      ],
      ourTeamNumber: null,
      strategy: "balanced",
    });
    expect(result[0].teamNumber).toBe(1);
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("respects the limit and returns an empty list when nothing is available", () => {
    const teams = [team({ teamNumber: 1 }), team({ teamNumber: 2 }), team({ teamNumber: 3 })];
    expect(suggestPickList({ teams, ourTeamNumber: null, strategy: "balanced", limit: 2 })).toHaveLength(2);
    expect(
      suggestPickList({ teams, ourTeamNumber: null, strategy: "balanced", excludeTeams: [1, 2, 3] })
    ).toEqual([]);
  });

  it("ranks on scouted output when no official results exist yet", () => {
    // EPA/OPR are all zero before matches are played — the common case early at
    // an event. The strong scorer should still come out on top.
    const teams = [
      team({ teamNumber: 1, epa: 0, opr: 0, avgFuel: 90, avgClimb: 3, fuelConsistency: 0.5 }),
      team({ teamNumber: 2, epa: 0, opr: 0, avgFuel: 5, avgClimb: 0, fuelConsistency: 1 }),
    ];
    expect(hasOfficialResultSignal(teams)).toBe(false);

    const result = suggestPickList({ teams, ourTeamNumber: null, strategy: "balanced" });
    expect(result[0].teamNumber).toBe(1);
    expect(result[0].reasons.join(" ")).toContain("Top fuel output");
  });

  it("detects when official results are available", () => {
    expect(hasOfficialResultSignal([team({ teamNumber: 1, epa: 40 }), team({ teamNumber: 2, epa: 10 })])).toBe(true);
    expect(hasOfficialResultSignal([])).toBe(false);
  });

  it("falls back to contribution ranking when our team has no data", () => {
    const result = suggestPickList({
      teams: [team({ teamNumber: 1, epa: 10 }), team({ teamNumber: 2, epa: 90 })],
      ourTeamNumber: 999, // not in the pool
      strategy: "complement",
    });
    expect(result[0].teamNumber).toBe(2);
  });
});
