/**
 * Suggested pick list generation.
 *
 * Raw scoring power (EPA/OPR) is only half of alliance selection — the other
 * half is what a partner adds that you don't already have. These functions
 * blend contribution, fit against your own robot's profile, and reliability,
 * and explain every suggestion so the strategy team can sanity-check it rather
 * than trusting a black box.
 */

export interface TeamStatLine {
  teamNumber: number;
  teamName: string;
  epa: number;
  opr: number;
  avgFuel: number;
  avgClimb: number;
  avgSkill: number;
  skillAverages: Record<string, number>;
  autonWinRate: number;
  autonContributionRate: number;
  breakdownRate: number;
  /** 0-1, higher means their fuel output varies less match to match. */
  fuelConsistency: number;
  matchesScoutedCount: number;
}

export type PickStrategy = "balanced" | "complement" | "mirror" | "defensive";

export interface PickSuggestion {
  teamNumber: number;
  teamName: string;
  /** 0-100, comparable only within one run. */
  score: number;
  reasons: string[];
  warnings: string[];
}

/** Capability axes used for fit. Kept small and scouting-derived. */
const CAPABILITIES = ["fuel", "climb", "auton", "defense", "shuttling"] as const;
type Capability = (typeof CAPABILITIES)[number];

const CAPABILITY_LABELS: Record<Capability, string> = {
  fuel: "fuel scoring",
  climb: "endgame climbing",
  auton: "autonomous",
  defense: "defense",
  shuttling: "shuttling",
};

const STRATEGY_WEIGHTS: Record<
  PickStrategy,
  { contribution: number; fit: number; reliability: number; consistency: number }
> = {
  balanced: { contribution: 0.6, fit: 0.1, reliability: 0.2, consistency: 0.1 },
  // Fit outweighs raw output here, otherwise this collapses into "balanced".
  // Safe to weight heavily because fit rewards being *strong* where we're weak,
  // not merely being different from us.
  complement: { contribution: 0.3, fit: 0.55, reliability: 0.1, consistency: 0.05 },
  mirror: { contribution: 0.5, fit: 0.3, reliability: 0.15, consistency: 0.05 },
  defensive: { contribution: 0.25, fit: 0.5, reliability: 0.2, consistency: 0.05 },
};

function rawCapabilities(team: TeamStatLine): Record<Capability, number> {
  return {
    fuel: team.avgFuel,
    climb: team.avgClimb,
    auton: team.autonContributionRate,
    defense: team.skillAverages.defense ?? 0,
    shuttling: team.skillAverages.shuttling ?? 0,
  };
}

/** Min-max normalize one capability across the pool so axes are comparable. */
function buildNormalizer(teams: TeamStatLine[]) {
  const ranges = new Map<Capability, { min: number; max: number }>();
  for (const cap of CAPABILITIES) {
    const values = teams.map((t) => rawCapabilities(t)[cap]);
    ranges.set(cap, { min: Math.min(...values), max: Math.max(...values) });
  }
  return (team: TeamStatLine): Record<Capability, number> => {
    const raw = rawCapabilities(team);
    const out = {} as Record<Capability, number>;
    for (const cap of CAPABILITIES) {
      const { min, max } = ranges.get(cap)!;
      out[cap] = max - min < 1e-9 ? 0.5 : (raw[cap] - min) / (max - min);
    }
    return out;
  };
}

function normalizeValues(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-9) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

/**
 * EPA and OPR are derived from official alliance scores, so before any matches
 * have been played (or if results were never imported) they're all zero and
 * carry no ranking signal. Callers use this to tell the user that suggestions
 * are running on scouting data alone.
 */
export function hasOfficialResultSignal(teams: TeamStatLine[]): boolean {
  if (teams.length === 0) return false;
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  return spread(teams.map((t) => t.epa)) > 1e-6 || spread(teams.map((t) => t.opr)) > 1e-6;
}

export interface SuggestOptions {
  teams: TeamStatLine[];
  /** Our own team, used for complement/mirror fit. Null falls back to pure contribution. */
  ourTeamNumber: number | null;
  strategy: PickStrategy;
  /** Teams already on the pick list, or otherwise unavailable. */
  excludeTeams?: number[];
  limit?: number;
  /** Below this many scouted matches a team is flagged as low-confidence. */
  minMatchesForConfidence?: number;
}

export function suggestPickList(options: SuggestOptions): PickSuggestion[] {
  const {
    teams,
    ourTeamNumber,
    strategy,
    excludeTeams = [],
    limit,
    minMatchesForConfidence = 3,
  } = options;

  const excluded = new Set([...excludeTeams, ...(ourTeamNumber != null ? [ourTeamNumber] : [])]);
  // Normalize against the whole pool (including us) so scores stay stable as
  // teams get picked off the board.
  const normalize = buildNormalizer(teams);
  const ourProfile = ourTeamNumber != null ? teams.find((t) => t.teamNumber === ourTeamNumber) : undefined;
  const ourCaps = ourProfile ? normalize(ourProfile) : null;

  const candidates = teams.filter((t) => !excluded.has(t.teamNumber));
  if (candidates.length === 0) return [];

  const epaNorm = normalizeValues(candidates.map((t) => t.epa));
  const oprNorm = normalizeValues(candidates.map((t) => t.opr));
  const weights = STRATEGY_WEIGHTS[strategy];

  // Before official results exist, EPA/OPR are flat — rank on what our own
  // scouts recorded instead, so suggestions are useful from the first match.
  const usingOfficialResults = hasOfficialResultSignal(candidates);
  const fuelNorm = normalizeValues(candidates.map((t) => t.avgFuel));
  const climbNorm = normalizeValues(candidates.map((t) => t.avgClimb));
  const autonNorm = normalizeValues(candidates.map((t) => t.autonContributionRate));

  const suggestions = candidates.map((team, i) => {
    const caps = normalize(team);
    const contribution = usingOfficialResults
      ? 0.6 * epaNorm[i] + 0.4 * oprNorm[i]
      : 0.6 * fuelNorm[i] + 0.3 * climbNorm[i] + 0.1 * autonNorm[i];
    const reliability = 1 - Math.min(1, team.breakdownRate);
    const consistency = team.fuelConsistency;

    let fit = 0.5;
    const reasons: string[] = [];

    if (strategy === "defensive") {
      fit = caps.defense;
      if (caps.defense > 0.6) reasons.push("Rated highly on defense");
    } else if (ourCaps) {
      if (strategy === "complement") {
        // Reward strength where we're weak.
        let total = 0;
        const gaps: { cap: Capability; value: number }[] = [];
        for (const cap of CAPABILITIES) {
          const contributionToFit = caps[cap] * (1 - ourCaps[cap]);
          total += contributionToFit;
          if (ourCaps[cap] < 0.45 && caps[cap] > 0.55) gaps.push({ cap, value: contributionToFit });
        }
        fit = total / CAPABILITIES.length;
        gaps
          .sort((a, b) => b.value - a.value)
          .slice(0, 2)
          .forEach((g) => reasons.push(`Covers your gap in ${CAPABILITY_LABELS[g.cap]}`));
      } else if (strategy === "mirror") {
        // Reward similarity to us.
        let distance = 0;
        for (const cap of CAPABILITIES) distance += Math.abs(caps[cap] - ourCaps[cap]);
        fit = 1 - distance / CAPABILITIES.length;
        if (fit > 0.75) reasons.push("Plays a similar game to you");
      }
    }

    const score =
      weights.contribution * contribution +
      weights.fit * fit +
      weights.reliability * reliability +
      weights.consistency * consistency;

    if (usingOfficialResults && epaNorm[i] > 0.75) {
      reasons.push(`Top-tier scoring (EPA ${team.epa.toFixed(1)})`);
    } else if (!usingOfficialResults && fuelNorm[i] > 0.75) {
      reasons.push(`Top fuel output (${team.avgFuel.toFixed(0)}/match scouted)`);
    }
    if (team.avgClimb >= 2.5) reasons.push(`Reliable high climb (avg L${team.avgClimb.toFixed(1)})`);
    if (team.autonWinRate >= 70) reasons.push(`Wins auton ${team.autonWinRate.toFixed(0)}% of the time`);
    if (consistency > 0.8 && team.matchesScoutedCount >= minMatchesForConfidence) {
      reasons.push("Very consistent match to match");
    }

    const warnings: string[] = [];
    if (team.matchesScoutedCount === 0) {
      warnings.push("No scouting data — ranked on event results only");
    } else if (team.matchesScoutedCount < minMatchesForConfidence) {
      warnings.push(`Only ${team.matchesScoutedCount} match(es) scouted`);
    }
    if (team.breakdownRate > 0.25) {
      warnings.push(`Broke down in ${(team.breakdownRate * 100).toFixed(0)}% of scouted matches`);
    }

    return {
      teamNumber: team.teamNumber,
      teamName: team.teamName,
      score: Math.round(score * 1000) / 10,
      reasons: reasons.slice(0, 3),
      warnings,
    };
  });

  suggestions.sort((a, b) => b.score - a.score || a.teamNumber - b.teamNumber);
  return limit != null ? suggestions.slice(0, limit) : suggestions;
}
