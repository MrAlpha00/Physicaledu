import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(2, "Use at least two characters.")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.");

const optionalDate = z.union([z.string().min(1), z.null()]).optional();
const usn = z.string().trim().min(6).max(24).regex(/^[a-zA-Z0-9-]+$/, "Enter a valid USN.");

export const eventStatusSchema = z.enum([
  "draft", "published", "registration_open", "registration_closed",
  "ongoing", "completed", "archived",
]);

export const eventSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3, "Enter the event name.").max(160),
  slug,
  description: z.string().trim().max(4000).optional().default(""),
  academicYear: z.string().trim().min(3).max(24),
  startsOn: optionalDate,
  endsOn: optionalDate,
  registrationOpensAt: optionalDate,
  registrationClosesAt: optionalDate,
  venue: z.string().trim().max(200).optional().default(""),
  instructions: z.string().trim().max(6000).optional().default(""),
  contactInformation: z.string().trim().max(500).optional().default(""),
  isPublic: z.boolean().default(false),
  status: eventStatusSchema.default("draft"),
  bannerFileId: z.string().uuid().nullable().optional(),
  logoFileId: z.string().uuid().nullable().optional(),
});

export type EventInput = z.infer<typeof eventSchema>;

export const sportSchema = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  slug,
  description: z.string().trim().max(4000).optional().default(""),
  category: z.string().trim().max(80).optional().default(""),
  mode: z.enum(["team", "individual"]),
  venue: z.string().trim().max(200).optional().default(""),
  registrationStart: optionalDate,
  registrationDeadline: optionalDate,
  competitionDate: optionalDate,
  maxEntries: z.number().int().positive().nullable().optional(),
  isPublic: z.boolean().default(true),
  status: eventStatusSchema.default("draft"),
  scoringMode: z.enum(["simple", "sets", "time", "manual"]).default("simple"),
  tournamentFormat: z.enum(["knockout", "round_robin", "group_knockout"]).default("knockout"),
  drawMode: z.enum(["random", "seeded", "manual"]).default("random"),
  thirdPlace: z.boolean().default(false),
  groupCount: z.number().int().min(2).max(32).nullable().optional(),
  qualifiersPerGroup: z.number().int().positive().nullable().optional(),
  legs: z.number().int().min(1).max(2).default(1),
  pointsWin: z.number().int().min(0).default(3),
  pointsDraw: z.number().int().min(0).default(1),
  pointsLoss: z.number().int().min(0).default(0),
  tiebreakers: z.array(z.enum([
    "competition_points", "point_difference", "points_scored", "wins", "head_to_head",
  ])).min(1).default(["competition_points", "point_difference", "points_scored", "wins"]),
  autoAdvance: z.boolean().default(true),
  organizerResultsRequireApproval: z.boolean().default(false),
  publicRules: z.string().trim().max(8000).optional().default(""),
});

export type SportInput = z.infer<typeof sportSchema>;

export const competitionRulesSchema = z.object({
  competitionId: z.string().uuid(),
  teamNameRequired: z.boolean().default(true),
  minTeamSize: z.number().int().positive().nullable().optional(),
  maxTeamSize: z.number().int().positive().nullable().optional(),
  teamLimit: z.number().int().positive().nullable().optional(),
  captainRequired: z.boolean().default(true),
  substituteAllowance: z.number().int().min(0).max(20).default(0),
  allowMultipleCompetitions: z.boolean().default(true),
  allowDuplicatePlayerOtherTeam: z.boolean().default(false),
  requireMemberConfirmation: z.boolean().default(false),
  requireManualIdentityVerification: z.boolean().default(false),
  requiredParticipantFields: z.array(z.string()).default([]),
  customQuestions: z.array(z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(["text", "number", "select"]),
    options: z.array(z.string()).default([]),
    required: z.boolean().default(false),
  })).default([]),
  publicRules: z.string().max(8000).optional().default(""),
  eligibilitySummary: z.string().max(4000).optional().default(""),
});

export type CompetitionRulesInput = z.infer<typeof competitionRulesSchema>;

export const eligibilityRuleSchema = z.object({
  competitionId: z.string().uuid(),
  ruleType: z.enum(["department", "semester", "academic_year", "min_weight", "max_weight", "custom"]),
  ruleValue: z.record(z.string(), z.unknown()),
  description: z.string().max(500).optional().default(""),
});

export const paymentSettingsSchema = z.object({
  competitionId: z.string().uuid(),
  isRequired: z.boolean().default(false),
  feeAmount: z.number().min(0).nullable().optional(),
  paymentUnit: z.enum(["team", "participant"]).default("team"),
  instructions: z.string().max(4000).optional().default(""),
  paymentDeadline: optionalDate,
  qrFileId: z.string().uuid().nullable().optional(),
});

export const registrationSchema = z.object({
  kind: z.enum(["team", "individual"]),
  teamName: z.string().trim().max(120).optional().default(""),
  captainUsn: usn.optional().default(""),
  contactEmail: z.string().trim().email().optional().default(""),
  contactPhone: z.string().trim().max(30).optional().default(""),
  seed: z.number().int().positive().nullable().optional(),
  answers: z.record(z.string(), z.unknown()).default({}),
  members: z.array(z.object({
    usn,
    weightKg: z.number().min(1).max(499).nullable().optional(),
    isCaptain: z.boolean().default(false),
    isSubstitute: z.boolean().default(false),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })).min(1).max(40),
}).superRefine((value, ctx) => {
  const usns = value.members.map((member) => member.usn.trim().toUpperCase());
  if (new Set(usns).size !== usns.length) {
    ctx.addIssue({ code: "custom", message: "The same student cannot appear twice in one entry." });
  }
  if (value.kind === "team" && !value.teamName.trim()) {
    ctx.addIssue({ code: "custom", path: ["teamName"], message: "Team name is required." });
  }
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const resultSchema = z.object({
  matchId: z.string().uuid(),
  scoreA: z.string().trim().optional().default(""),
  scoreB: z.string().trim().optional().default(""),
  winnerEntryId: z.string().uuid(),
  notes: z.string().trim().max(2000).optional().default(""),
  breakdown: z.array(z.object({
    set: z.number().int().positive(),
    scoreA: z.number(),
    scoreB: z.number(),
  })).default([]),
});

export type ResultInput = z.infer<typeof resultSchema>;

export const matchScheduleSchema = z.object({
  matchId: z.string().uuid(),
  startsAt: optionalDate,
  endsAt: optionalDate,
  venue: z.string().trim().max(200).nullable().optional(),
  status: z.enum([
    "scheduled", "ready", "ongoing", "postponed", "cancelled", "disputed",
  ]).nullable().optional(),
  organizerId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  calendarEventId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export const invitationSchema = z.object({
  competitionId: z.string().uuid(),
  studentDirectoryId: z.string().uuid(),
  expiresHours: z.number().int().min(1).max(720).default(72),
});

export const drawSchema = z.object({
  competitionId: z.string().uuid(),
  drawSeed: z.number().int().min(0).optional(),
  manualOrder: z.array(z.string().uuid()).optional(),
  thirdPlace: z.boolean().optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
});
