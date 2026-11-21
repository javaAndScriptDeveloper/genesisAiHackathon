import { z } from "zod";
import { addDays, mondayOf, type ISODate } from "./dates";
import { EXERCISES, isUsable } from "./exercises";
import { EQUIPMENT, EXPERIENCES, GENDERS, GOALS, LIMITATIONS, LOCATIONS, WEARABLES } from "./options";
import { DAY_PATTERNS, buildBlock, estimateMinutes, generatePlan } from "./plan";
import type { ExerciseBlock, Profile, PlannedWorkout } from "./types";

// An AI-written plan is a one-week template (one session per training day). The model only picks from our
// exercise library and sets the dose; dates, loads and durations are computed here, so a bad reply can never
// produce an exercise the user cannot do or a nonsense schedule.

/** Request body of `POST /api/plan`: the profile plus the chosen coach's voice. */
export const planRequestSchema = z.object({
	profile: z.object({
		name: z.string().max(30),
		age: z.number().int().min(14).max(90),
		gender: z.enum(GENDERS).nullable(),
		heightCm: z.number().min(120).max(230),
		weightKg: z.number().min(30).max(250),
		goal: z.enum(GOALS),
		goalText: z.string().max(500).optional(),
		experience: z.enum(EXPERIENCES),
		location: z.enum(LOCATIONS),
		equipment: z.array(z.enum(EQUIPMENT)),
		durationMin: z.number().int().min(10).max(120),
		daysPerWeek: z.number().int().min(1).max(6),
		limitations: z.array(z.enum(LIMITATIONS)),
		limitationNote: z.string().max(500),
		wearable: z.enum(WEARABLES),
	}),
	trainer: z.object({ name: z.string().max(60), tov: z.string().max(500) }).optional(),
});
export type PlanRequest = z.infer<typeof planRequestSchema>;

const clampInt =(min: number, max: number) => z.coerce.number().transform((n) => Math.round(Math.min(max, Math.max(min, n))));

export const aiPlanSchema = z.object({
	summary: z.string().trim().max(400).default(""),
	why: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
	sessions: z
		.array(
			z.object({
				title: z.string().trim().min(1).max(40),
				exercises: z
					.array(z.object({ id: z.string(), sets: clampInt(1, 6), reps: clampInt(1, 90), restSec: clampInt(10, 240) }))
					.min(1)
					.max(10),
			}),
		)
		.min(1)
		.max(7),
});
export type AiPlan = z.infer<typeof aiPlanSchema>;

/** Parses the model's text (plain JSON or fenced) into a template; `null` when it is unusable. */
export function parseAiPlan(text: string): AiPlan | null {
	const json = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
	try {
		const parsed = aiPlanSchema.safeParse(JSON.parse(json));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/** The part of the library the user can actually do, in the compact shape sent to the model. */
export function exerciseCatalog(profile: Pick<Profile, "location" | "equipment" | "limitations">) {
	return EXERCISES.filter((e) => isUsable(e, profile)).map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, kind: e.kind, level: e.level, timed: Boolean(e.timed) }));
}

const capitalize = (s: string) => (s[0]?.toUpperCase() ?? "") + s.slice(1);

/**
 * Lays the template onto the user's training days for `weeks` weeks from `from`. Unknown or unusable exercises are
 * dropped; a session left with fewer than two falls back to the rule-based workout for that date.
 */
export function planFromAi(template: AiPlan, profile: Profile, from: ISODate, weeks = 4): PlannedWorkout[] {
	const fallback = new Map(generatePlan(profile, from, weeks).map((w) => [w.date, w]));
	const byId = new Map(EXERCISES.filter((e) => isUsable(e, profile)).map((e) => [e.id, e]));
	const days = DAY_PATTERNS[profile.daysPerWeek] ?? DAY_PATTERNS[3] ?? [];
	const start = mondayOf(from);
	const out: PlannedWorkout[] = [];
	let count = 0;
	for (let w = 0; w < weeks; w += 1) {
		for (const day of days) {
			const date = addDays(start, w * 7 + day);
			if (date < from) continue;
			const session = template.sessions[count % template.sessions.length];
			count += 1;
			const seen = new Set<string>();
			const blocks: ExerciseBlock[] = [];
			for (const item of session?.exercises ?? []) {
				const exercise = byId.get(item.id);
				if (!exercise || seen.has(exercise.id)) continue;
				seen.add(exercise.id);
				blocks.push(buildBlock(exercise, profile, 1, { sets: item.sets, reps: item.reps, rest: item.restSec }));
			}
			const rule = fallback.get(date);
			if (!session || blocks.length < 2) {
				if (rule) out.push(rule);
				continue;
			}
			const muscles = Array.from(new Set(blocks.map((b) => byId.get(b.exerciseId)?.muscle).filter((m) => m && m !== "mobility")));
			out.push({
				id: `w-${date}`,
				date,
				title: session.title,
				focus: muscles.slice(0, 3).map((m) => capitalize(m ?? "")).join(" · "),
				durationMin: estimateMinutes(blocks),
				difficulty: rule?.difficulty ?? 2,
				exercises: blocks,
				status: "planned",
			});
		}
	}
	return out;
}
