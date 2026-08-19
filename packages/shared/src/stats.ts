/**
 * OPR / EPA / blended-ranking math. Pure functions, no I/O, so they're
 * usable from both the server (computing dashboard stats) and unit tests.
 */

export interface AllianceMatchResult {
  matchKey: string;
  /** The 3 team numbers on this alliance for this match. */
  teams: number[];
  /** This alliance's score in whichever category is being measured (fuel, tower, total, ...). */
  score: number;
  /** Match order for EPA's recency weighting (e.g. match number). Lower = earlier. */
  order: number;
}

// ---- small linear algebra (Gaussian elimination with partial pivoting) ----

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  // Augment A with b for in-place elimination.
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot.
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivotRow][col])) pivotRow = row;
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) continue; // singular direction; leave as 0 contribution

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col] / pivot;
      for (let c = col; c <= n; c++) {
        M[row][c] -= factor * M[col][c];
      }
    }
  }

  return M.map((row, i) => (Math.abs(row[i]) < 1e-10 ? 0 : row[n] / row[i]));
}

/**
 * Classic FRC OPR: solve for per-team contribution x such that, for every
 * alliance-in-a-match row, (sum of x over that alliance's teams) best
 * approximates that alliance's score, in a least-squares sense.
 *
 * Solved via the normal equations (A^T A) x = A^T b.
 */
export function computeOPR(
  results: AllianceMatchResult[],
  teamNumbers: number[]
): Map<number, number> {
  const teams = [...new Set(teamNumbers)];
  const index = new Map(teams.map((t, i) => [t, i]));
  const n = teams.length;
  if (n === 0) return new Map();

  const A: number[][] = results.map((r) => {
    const row = new Array(n).fill(0);
    for (const t of r.teams) {
      const i = index.get(t);
      if (i !== undefined) row[i] = 1;
    }
    return row;
  });
  const b = results.map((r) => r.score);

  // AtA (n x n) and Atb (n)
  const AtA: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb: number[] = new Array(n).fill(0);
  for (let row = 0; row < A.length; row++) {
    for (let i = 0; i < n; i++) {
      if (A[row][i] === 0) continue;
      Atb[i] += A[row][i] * b[row];
      for (let j = 0; j < n; j++) {
        if (A[row][j] === 0) continue;
        AtA[i][j] += A[row][i] * A[row][j];
      }
    }
  }

  const x = solveLinearSystem(AtA, Atb);
  return new Map(teams.map((t, i) => [t, x[i]]));
}

export interface ComputeEpaOptions {
  /** How strongly each match nudges the running estimate toward its actual result (0-1). */
  learningRate?: number;
  /** How many chronological passes to run. 1 is a true "rolling" estimate; >1 lets it settle faster for a static dataset. */
  passes?: number;
}

/**
 * EPA-inspired rolling estimate: seeded from OPR, then walked forward through
 * matches in chronological order, nudging each contributing team's estimate
 * toward the alliance's actual score for that match. This is our own
 * simplified model, not a reproduction of Statbotics' algorithm.
 */
export function computeEPA(
  results: AllianceMatchResult[],
  teamNumbers: number[],
  opts: ComputeEpaOptions = {}
): Map<number, number> {
  const { learningRate = 0.3, passes = 1 } = opts;
  const teams = [...new Set(teamNumbers)];
  const opr = computeOPR(results, teams);

  const epa = new Map<number, number>(teams.map((t) => [t, opr.get(t) ?? 0]));
  const sorted = [...results].sort((a, b) => a.order - b.order);

  for (let pass = 0; pass < Math.max(1, passes); pass++) {
    for (const r of sorted) {
      if (r.teams.length === 0) continue;
      const predicted = r.teams.reduce((sum, t) => sum + (epa.get(t) ?? 0), 0);
      const error = r.score - predicted;
      const perTeamAdjustment = (learningRate * error) / r.teams.length;
      for (const t of r.teams) {
        epa.set(t, (epa.get(t) ?? 0) + perTeamAdjustment);
      }
    }
  }

  return epa;
}

// ---- blended ranking ----

export interface TeamMetrics {
  teamNumber: number;
  metrics: Record<string, number>;
}

/**
 * Normalizes each named metric to 0-1 across the team set, then combines
 * per team using the supplied weights (weights need not sum to 1).
 * Returns teams sorted best-first.
 */
export function computeBlendedRank(
  teamMetrics: TeamMetrics[],
  weights: Record<string, number>
): { teamNumber: number; score: number }[] {
  const metricNames = Object.keys(weights);
  const ranges = new Map<string, { min: number; max: number }>();
  for (const name of metricNames) {
    const values = teamMetrics.map((t) => t.metrics[name] ?? 0);
    ranges.set(name, { min: Math.min(...values), max: Math.max(...values) });
  }

  const scored = teamMetrics.map((t) => {
    let score = 0;
    for (const name of metricNames) {
      const { min, max } = ranges.get(name)!;
      const raw = t.metrics[name] ?? 0;
      const normalized = max - min < 1e-9 ? 0.5 : (raw - min) / (max - min);
      score += normalized * weights[name];
    }
    return { teamNumber: t.teamNumber, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}
