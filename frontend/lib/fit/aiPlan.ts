import { z } from "zod";
import { applyAdapt } from "./adapt";
import type { DailyStatus } from "./dailyStats";
import { addDays, mondayOf, type ISODate } from "./dates";
import { findExercise, getExercise, isUsable } from "./exercises";
import { DAY_PATTERNS, buildAdHocWorkout, difficultyOf, estimateMinutes, generatePlan, nextBlockId, roundLoad, startingWeight } from "./plan";
import type { Exercise, ExerciseBlock, PlannedWorkout, Profile, SetEntry } from "./types";

export const aiExerciseSchema = z.object({
	exerciseId: z.string(),
	sets: z.number(),
	reps: z.number().optional(),
	seconds: z.number().optional(),
	restSec: z.number(),
});
export const aiWeekSchema = z.object({
	summary: z.string(),
	sessions: z.array(z.object({ weekday: z.number().int(), title: z.string(), focus: z.string(), exercises: z.array(aiExerciseSchema) })),
});
export const aiSessionSchema = z.object({ note: z.string(), title: z.string(), exercises: z.array(aiExerciseSchema) });
export type AiWeek = z.infer<typeof aiWeekSchema>;
export type AiSession = z.infer<typeof aiSessionSchema>;
type AiExercise = z.infer<typeof aiExerciseSchema>;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));
const trim40 = (s: string) => s.trim().slice(0, 40);

interface Cleaned {
	exercise: Exercise;
	sets: number;
	target: number;
	restSec: number;
	weight: number | undefined;
}

/** Keeps only library exercises the user can do, without duplicates, with clamped numbers. */
function cleanExercises(list: AiExercise[], profile: Profile): Cleaned[] {
	const seen = new Set<string>();
	const out: Cleaned[] = [];
	for (const item of list) {
		const exercise = findExercise(item.exerciseId);
		if (!exercise || !isUsable(exercise, profile) || seen.has(exercise.id)) continue;
		seen.add(exercise.id);
		out.push({
			exercise,
			sets: clamp(item.sets, 1, 6),
			target: exercise.timed ? clamp(item.seconds ?? item.reps ?? 30, 15, 120) : clamp(item.reps ?? 10, 3, 30),
			restSec: clamp(item.restSec, 15, 180),
			weight: startingWeight(exercise, profile),
		});
	}
	return out;
}

function toBlock(c: Cleaned, week: number): ExerciseBlock {
	const timed = Boolean(c.exercise.timed);
	let target = c.target;
	let weight = c.weight;
	if (week > 0) {
		if (timed) target = clamp(target + 5 * week, 15, 120);
		else if (weight === undefined) target += week;
		else weight = roundLoad(weight * (1 + 0.025 * week));
	}
	const sets: SetEntry[] = Array.from({ length: c.sets }, () => ({ target, targetWeight: weight, done: false }));
	return { id: nextBlockId(), exerciseId: c.exercise.id, restSec: c.restSec, sets };
}

function trimToDuration(blocks: ExerciseBlock[], durationMin: number): ExerciseBlock[] {
	const out = [...blocks];
	while (estimateMinutes(out) > durationMin + 10 && out.length > 2) out.pop();
	return out;
}

export function buildPlanFromAi(week: AiWeek, profile: Profile, today: ISODate, weeks = 4): { planned: PlannedWorkout[]; valid: boolean } {
	interface Slot {
		weekday: number;
		title: string;
		focus: string;
		cleaned: Cleaned[];
	}
	const byDay = new Map<number, Slot>();
	for (const s of week.sessions) {
		if (s.weekday < 0 || s.weekday > 6 || byDay.has(s.weekday)) continue;
		const cleaned = cleanExercises(s.exercises, profile);
		if (cleaned.length < 2) continue;
		byDay.set(s.weekday, { weekday: s.weekday, title: s.title, focus: s.focus, cleaned });
	}
	const slots = [...byDay.values()].sort((a, b) => a.weekday - b.weekday).slice(0, profile.daysPerWeek);
	const valid = slots.length >= Math.ceil(profile.daysPerWeek / 2);

	const used = new Set(slots.map((s) => s.weekday));
	const pattern = DAY_PATTERNS[profile.daysPerWeek] ?? DAY_PATTERNS[3] ?? [];
	const fillDays = pattern.filter((d) => !used.has(d)).slice(0, Math.max(0, profile.daysPerWeek - slots.length));
	const rule = new Map(generatePlan(profile, today, weeks).map((w) => [w.date, w]));

	const start = mondayOf(today);
	const planned: PlannedWorkout[] = [];
	for (let w = 0; w < weeks; w += 1) {
		const days = [...slots.map((s) => s.weekday), ...fillDays].sort((a, b) => a - b);
		for (const weekday of days) {
			const date = addDays(start, w * 7 + weekday);
			if (date < today) continue;
			const slot = slots.find((s) => s.weekday === weekday);
			if (!slot) {
				const filled = rule.get(date);
				if (filled) planned.push(filled);
				continue;
			}
			const exercises = trimToDuration(slot.cleaned.map((c) => toBlock(c, w)), profile.durationMin);
			planned.push({
				id: `w-${date}`,
				date,
				title: trim40(slot.title),
				focus: trim40(slot.focus),
				durationMin: estimateMinutes(exercises),
				difficulty: difficultyOf(profile, exercises),
				exercises,
				status: "planned",
			});
		}
	}
	return { planned, valid };
}

const totalSets = (blocks: ExerciseBlock[]) => blocks.reduce((n, b) => n + b.sets.length, 0);

export function buildDailySession(ai: AiSession, original: PlannedWorkout, status: Exclude<DailyStatus, "unchanged">, profile: Profile): PlannedWorkout | null {
	const cleaned = cleanExercises(ai.exercises, profile);
	if (cleaned.length < 2) return null;
	if (status === "recovery" && cleaned.some((c) => c.exercise.kind !== "mobility" && c.exercise.kind !== "cardio" && c.exercise.muscle !== "core")) return null;
	const exercises = cleaned.map((c) => toBlock(c, 0));
	const minutes = estimateMinutes(exercises);
	if (status === "recovery" && minutes > 30) return null;
	if (status === "lighter" && (totalSets(exercises) > totalSets(original.exercises) || minutes > original.durationMin)) return null;
	return {
		...original,
		title: status === "recovery" ? trim40(ai.title) || "Active recovery" : original.title,
		focus: status === "recovery" ? "Active recovery" : original.focus,
		durationMin: minutes,
		difficulty: Math.min(original.difficulty, difficultyOf(profile, exercises)) as PlannedWorkout["difficulty"],
		exercises,
	};
}

export function fallbackDaily(original: PlannedWorkout, status: Exclude<DailyStatus, "unchanged">, profile: Profile): PlannedWorkout {
	if (status === "lighter") {
		const { exercises } = applyAdapt(original.exercises, { kind: "tired" }, { profile, startIndex: 0 });
		return { ...original, exercises, durationMin: estimateMinutes(exercises) };
	}
	const { adHoc: _adHoc, ...rest } = buildAdHocWorkout("mobility", original.date, profile);
	return { ...rest, id: original.id };
}

function weekNames(plan: PlannedWorkout[], today: ISODate): string[] {
	const end = addDays(today, 7);
	return plan
		.filter((w) => w.status === "planned" && w.date >= today && w.date < end)
		.flatMap((w) => w.exercises.map((b) => getExercise(b.exerciseId).name));
}

export function diffPlans(before: PlannedWorkout[], after: PlannedWorkout[], today: ISODate): { added: string[]; removed: string[] } {
	const b = weekNames(before, today);
	const a = weekNames(after, today);
	const only = (x: string[], y: string[]) => [...new Set(x.filter((n) => !y.includes(n)))].sort();
	return { added: only(a, b), removed: only(b, a) };
}
