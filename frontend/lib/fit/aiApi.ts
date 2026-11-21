import { z } from "zod";
import { coachAiReplySchema, type CoachAiReply } from "./aiPlan";
import { dailyStatsSchema, type DailyStats, type DailyStatus } from "./dailyStats";
import { EQUIPMENT, GENDERS, GOALS, LIMITATIONS, LOCATIONS, EXPERIENCES, WEARABLES } from "./options";
import type { ExerciseBlock, PlannedWorkout, Profile, SetEntry } from "./types";

// Request/response schemas for the AI routes, shared by server handlers and browser code (no server-only imports).

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const profileSchema: z.ZodType<Profile> = z.object({
	name: z.string().max(100),
	age: z.number().positive(),
	gender: z.enum(GENDERS).nullable(),
	heightCm: z.number().positive(),
	weightKg: z.number().positive(),
	goal: z.enum(GOALS),
	goalText: z.string().max(500).optional(),
	experience: z.enum(EXPERIENCES),
	location: z.enum(LOCATIONS),
	equipment: z.array(z.enum(EQUIPMENT)),
	durationMin: z.number().min(10).max(90),
	daysPerWeek: z.number().int().min(1).max(6),
	limitations: z.array(z.enum(LIMITATIONS)),
	limitationNote: z.string().max(1000),
	wearable: z.enum(WEARABLES),
});

const setEntrySchema: z.ZodType<SetEntry> = z.object({
	target: z.number(),
	targetWeight: z.number().optional(),
	reps: z.number().optional(),
	weight: z.number().optional(),
	done: z.boolean(),
});

const exerciseBlockSchema: z.ZodType<ExerciseBlock> = z.object({
	id: z.string(),
	exerciseId: z.string(),
	restSec: z.number(),
	sets: z.array(setEntrySchema),
	skipped: z.boolean().optional(),
	note: z.string().optional(),
});

export const plannedWorkoutSchema: z.ZodType<PlannedWorkout> = z.object({
	id: z.string(),
	date: isoDate,
	title: z.string(),
	focus: z.string(),
	durationMin: z.number(),
	difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
	exercises: z.array(exerciseBlockSchema),
	status: z.enum(["planned", "completed", "partial", "skipped"]),
	skipReason: z.enum(["recovery", "busy", "unwell"]).optional(),
	movedFrom: isoDate.optional(),
	adHoc: z.boolean().optional(),
	logId: z.string().optional(),
	partnerId: z.string().optional(),
});

export const planRequestSchema = z.object({
	userId: z.number().int().positive().nullable(),
	profile: profileSchema,
	trainerSlug: z.string().min(1).max(100),
	wishes: z.array(z.string().max(200)).max(10),
	today: isoDate,
});
export type PlanRequest = z.infer<typeof planRequestSchema>;

export const planResponseSchema = z.object({
	planned: z.array(plannedWorkoutSchema),
	summary: z.string(),
	createdBy: z.enum(["ai", "fallback"]),
	trainingId: z.number().nullable(),
});
export type PlanResponse = z.infer<typeof planResponseSchema>;

export const dailyRequestSchema = z.object({
	userId: z.number().int().positive(),
	profile: profileSchema,
	trainerSlug: z.string().min(1).max(100),
	session: plannedWorkoutSchema.nullable(),
	upcoming: z.array(plannedWorkoutSchema).max(100),
	wishes: z.array(z.string().max(200)).max(10),
	today: isoDate,
});
export type DailyRequest = z.infer<typeof dailyRequestSchema>;

export const dailyResponseSchema: z.ZodType<{ status: DailyStatus; session: PlannedWorkout | null; note: string; stats: DailyStats | null; createdBy: "ai" | "fallback" }> = z.object({
	status: z.enum(["unchanged", "lighter", "recovery"]),
	session: plannedWorkoutSchema.nullable(),
	note: z.string(),
	stats: dailyStatsSchema.nullable(),
	createdBy: z.enum(["ai", "fallback"]),
});
export type DailyResponse = z.infer<typeof dailyResponseSchema>;

export const coachRequestSchema = z.object({
	userId: z.number().int().positive().nullable(),
	profile: profileSchema,
	trainerSlug: z.string().min(1).max(100),
	wishes: z.array(z.string().max(200)).max(10),
	planSummary: z.string().max(4000),
	messages: z
		.array(z.object({ from: z.enum(["user", "coach"]), text: z.string().max(600) }))
		.min(1)
		.max(12)
		.refine((m) => m[m.length - 1]?.from === "user", "Last message must be from the user"),
});
export type CoachRequest = z.infer<typeof coachRequestSchema>;

export const coachResponseSchema: z.ZodType<{ reply: string; rebuild: CoachAiReply["rebuild"]; safety: boolean }> = z.object({
	reply: z.string(),
	rebuild: coachAiReplySchema.shape.rebuild,
	safety: z.boolean(),
});
export type CoachResponse = z.infer<typeof coachResponseSchema>;
