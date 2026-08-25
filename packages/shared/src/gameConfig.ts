/**
 * Game configuration for REBUILT presented by Haas (2026 FRC season).
 * Kept as a single config module (not hardcoded through the app) so a future
 * season's game can be swapped in by writing a new file with this same shape.
 */

export const GAME_CONFIG = {
  season: 2026,
  gameName: "REBUILT presented by Haas",
  autonSeconds: 20,
  teleopSeconds: 140,
  towerLevels: [1, 2, 3] as const,
  points: {
    fuelPerBall: 1,
    towerAuton: { 1: 15 },
    towerTeleop: { 1: 10, 2: 20, 3: 30 },
  },
  rankingPoints: {
    energized: { fuel: 100 },
    supercharged: { fuel: 360 },
    traversal: { towerPoints: 50 },
  },
  obstacles: [
    { id: "bump", label: "Bump (drive over)" },
    { id: "trench", label: "Trench (drive under)" },
  ],
  /** Top of the subjective skill rating scale (ratings run 1..skillScaleMax). */
  skillScaleMax: 10,
  /** Quick-add steps for fuel counters — REBUILT RPs need 100/360 fuel, so +1 alone is too slow. */
  fuelIncrements: [1, 5, 10],
  // Subjective/skill categories scouts rate per team per match.
  // Configurable so future seasons/teams can add or rename categories.
  skillCategories: [
    { id: "defense", label: "Defense" },
    { id: "shuttling", label: "Shuttling / Cycle speed" },
    { id: "driverSkill", label: "Driver skill" },
    { id: "fieldAwareness", label: "Human player skill" },
  ],
} as const;

export type TowerLevel = 0 | 1 | 2 | 3;
export type ObstacleId = (typeof GAME_CONFIG.obstacles)[number]["id"];
export type SkillCategoryId = (typeof GAME_CONFIG.skillCategories)[number]["id"];
