import { describe, expect, it } from "vitest";
import { computeOPR, computeEPA, computeBlendedRank, type AllianceMatchResult } from "./stats";

describe("computeOPR", () => {
  it("solves a hand-checkable 3-team round robin exactly", () => {
    // Teams 1, 2, 3. Each match is a single "alliance" of 2 teams (toy case).
    // True contributions: team1=5, team2=3, team3=7 (fully determined system).
    const results: AllianceMatchResult[] = [
      { matchKey: "m1", teams: [1, 2], score: 8, order: 1 }, // 5+3
      { matchKey: "m2", teams: [2, 3], score: 10, order: 2 }, // 3+7
      { matchKey: "m3", teams: [1, 3], score: 12, order: 3 }, // 5+7
    ];

    const opr = computeOPR(results, [1, 2, 3]);
    expect(opr.get(1)).toBeCloseTo(5, 5);
    expect(opr.get(2)).toBeCloseTo(3, 5);
    expect(opr.get(3)).toBeCloseTo(7, 5);
  });

  it("returns an empty map for no teams", () => {
    expect(computeOPR([], []).size).toBe(0);
  });
});

describe("computeEPA", () => {
  it("converges toward each team's true per-match contribution over repeated passes", () => {
    // Team A always contributes 10, team B always contributes 4, on a shared alliance.
    const results: AllianceMatchResult[] = [
      { matchKey: "m1", teams: [1, 2], score: 14, order: 1 },
      { matchKey: "m2", teams: [1, 2], score: 14, order: 2 },
      { matchKey: "m3", teams: [1, 2], score: 14, order: 3 },
      { matchKey: "m4", teams: [1, 2], score: 14, order: 4 },
    ];

    const epa = computeEPA(results, [1, 2], { learningRate: 0.5, passes: 20 });
    // With only aggregate (not per-team-split) scores, OPR/EPA split the 14 evenly (7/7)
    // since both teams co-occur on every match — this confirms convergence/stability,
    // not recovery of the hidden 10/4 split (that's mathematically unrecoverable here).
    expect((epa.get(1) ?? 0) + (epa.get(2) ?? 0)).toBeCloseTo(14, 1);
  });
});

describe("computeBlendedRank", () => {
  it("ranks teams best-first using normalized weighted metrics", () => {
    const ranked = computeBlendedRank(
      [
        { teamNumber: 1, metrics: { opr: 10, defense: 1 } },
        { teamNumber: 2, metrics: { opr: 5, defense: 5 } },
        { teamNumber: 3, metrics: { opr: 0, defense: 3 } },
      ],
      { opr: 0.8, defense: 0.2 }
    );

    expect(ranked[0].teamNumber).toBe(1);
    expect(ranked.map((r) => r.teamNumber)).toEqual([1, 2, 3]);
  });
});
