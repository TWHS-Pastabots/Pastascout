import { z } from "zod";

export const AllianceSchema = z.enum(["red", "blue"]);
export type Alliance = z.infer<typeof AllianceSchema>;

export const AutonPathWaypointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  t: z.number().min(0),
  eventType: z.enum(["pickup", "score", "crossObstacle"]).optional(),
});
export type AutonPathWaypoint = z.infer<typeof AutonPathWaypointSchema>;

/** A single freehand stroke traced by the scout, as a run of normalized points. */
export const AutonStrokeSchema = z.object({
  points: z.array(
    z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      t: z.number().min(0),
    })
  ),
});
export type AutonStroke = z.infer<typeof AutonStrokeSchema>;

export const AutonPathSchema = z.object({
  /** Tagged point events (picked up / scored / crossed an obstacle). */
  waypoints: z.array(AutonPathWaypointSchema),
  /** The drawn route. Defaults to [] so entries recorded before drawing existed still parse. */
  strokes: z.array(AutonStrokeSchema).default([]),
});
export type AutonPath = z.infer<typeof AutonPathSchema>;

export const SkillRatingSchema = z.object({
  categoryId: z.string(),
  score: z.number().int().min(1).max(10),
});
export type SkillRating = z.infer<typeof SkillRatingSchema>;

/** Where the robot lined up, tapped on the field map. Normalized 0-1, like waypoints. */
export const StartPositionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type StartPosition = z.infer<typeof StartPositionSchema>;

export const MatchScoutingEntrySchema = z.object({
  id: z.string().uuid(),
  matchId: z.string(),
  teamNumber: z.number().int().positive(),
  alliance: AllianceSchema,
  scoutName: z.string().min(1),
  createdAt: z.string(),

  auton: z.object({
    /** Null until the scout taps a spot on the field map. */
    startPosition: StartPositionSchema.nullable(),
    mobility: z.boolean(),
    fuelScored: z.number().int().min(0),
    towerClimbLevel: z.union([z.literal(0), z.literal(1)]),
    /** Whether this robot's alliance won auton (REBUILT gives the auton winner hub priority). */
    wonAuton: z.boolean(),
    /** Whether this particular robot contributed to the alliance's auton scoring. */
    contributedToAuton: z.boolean(),
  }),

  teleop: z.object({
    fuelScored: z.number().int().min(0),
    bumpCrossings: z.number().int().min(0),
    trenchCrossings: z.number().int().min(0),
    defensePlayed: z.boolean(),
    towerClimbLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  }),

  autonPath: AutonPathSchema,
  skillRatings: z.array(SkillRatingSchema),

  penalties: z.number().int().min(0).default(0),
  brokeDown: z.boolean().default(false),
  notes: z.string().default(""),

  /**
   * Set when this report shouldn't count toward the team's averages/rates —
   * e.g. the scout got the wrong robot, or something unrepresentative
   * happened. The entry is kept (not deleted) so it's still visible for
   * context, just excluded from the stats aggregation.
   */
  excludeFromStats: z.boolean().default(false),
});
export type MatchScoutingEntry = z.infer<typeof MatchScoutingEntrySchema>;

export const PitScoutingEntrySchema = z.object({
  id: z.string().uuid(),
  teamNumber: z.number().int().positive(),
  scoutName: z.string().min(1),
  createdAt: z.string(),

  drivetrainType: z.string().default(""),
  weightLbs: z.number().min(0).optional(),
  autonCapabilities: z.string().default(""),
  canClimbLevels: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).default([]),
  /** Whether the robot's low enough to drive under the Trench obstacle. */
  canGoUnderTrench: z.boolean().default(false),
  /** How many Fuel balls the robot can hold at once, per the pit interview. */
  fuelCapacity: z.number().int().min(0).optional(),
  /** Compressed photos as data URLs — see PhotoUpload.tsx for the size limits this assumes. */
  photos: z.array(z.string()).max(6).default([]),
  notes: z.string().default(""),
});
export type PitScoutingEntry = z.infer<typeof PitScoutingEntrySchema>;

export const TeamSchema = z.object({
  teamNumber: z.number().int().positive(),
  name: z.string(),
  tbaKey: z.string().optional(),
});
export type Team = z.infer<typeof TeamSchema>;

export const MatchSchema = z.object({
  id: z.string(),
  eventKey: z.string(),
  matchKey: z.string(),
  type: z.enum(["qual", "playoff"]),
  matchNumber: z.number().int().positive(),
  redTeams: z.array(z.number().int().positive()).length(3),
  blueTeams: z.array(z.number().int().positive()).length(3),
  scheduledTime: z.string().optional(),
  redScore: z.number().int().optional(),
  blueScore: z.number().int().optional(),
});
export type Match = z.infer<typeof MatchSchema>;

export type Role = "scout" | "analyst";
