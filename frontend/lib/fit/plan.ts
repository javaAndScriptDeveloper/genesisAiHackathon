import { addDays, daysBetween, mondayOf, weekdayIndex, type ISODate } from "./dates";
import { EXERCISES, getExercise, isUsable } from "./exercises";
import type { Exercise, ExerciseBlock, Experience, Goal, Muscle, PlannedWorkout, Profile, SetEntry } from "./types";

/** Training weekdays (Mon = 0) for each days-per-week choice, spaced to leave recovery days between sessions. */
export const DAY_PATTERNS: Record<number, number[]> = {
	1: [2],
	2: [1, 4],
	3: [0, 2, 4],
	4: [0, 1, 3, 4],
	5: [0, 1, 2, 4, 5],
	6: [0, 1, 2, 3, 4, 5],
};

interface Focus {
	title: string;
	slots: Muscle[];
}

const FULL: Focus[] = [
	{ title: "Full Body A", slots: ["legs", "chest", "back", "core", "glutes", "cardio"] },
	{ title: "Full Body B", slots: ["glutes", "shoulders", "back", "legs", "core", "cardio"] },
	{ title: "Full Body C", slots: ["legs", "back", "chest", "arms", "core", "cardio"] },
];
const UPPER_LOWER: Focus[] = [
	{ title: "Upper Body", slots: ["chest", "back", "shoulders", "arms", "core", "cardio"] },
	{ title: "Lower Body", slots: ["legs", "glutes", "legs", "core", "cardio", "core"] },
];
const SPLIT: Focus[] = [
	{ title: "Push", slots: ["chest", "shoulders", "chest", "arms", "core", "cardio"] },
	{ title: "Pull", slots: ["back", "back", "arms", "core", "shoulders", "cardio"] },
	{ title: "Legs & Glutes", slots: ["legs", "glutes", "legs", "core", "cardio", "core"] },
	{ title: "Upper Body", slots: ["chest", "back", "shoulders", "arms", "core", "cardio"] },
	{ title: "Lower Body", slots: ["legs", "glutes", "legs", "core", "cardio", "core"] },
	{ title: "Cardio & Core", slots: ["cardio", "core", "cardio", "core", "cardio", "core"] },
];

function focusesFor(days: number): Focus[] {
	if (days <= 3) return FULL;
	if (days === 4) return UPPER_LOWER;
	return SPLIT;
}

const SLOTS_BY_DURATION: [number, number][] = [
	[20, 3],
	[30, 4],
	[45, 5],
	[60, 6],
];

function slotCount(durationMin: number): number {
	let count = 3;
	for (const [min, n] of SLOTS_BY_DURATION) if (durationMin >= min) count = n;
	return count;
}

const EXPERIENCE_LEVEL: Record<Experience, number> = { beginner: 1, intermediate: 2, advanced: 3 };

interface Scheme {
	sets: number;
	reps: number;
	rest: number;
}

function schemeFor(goal: Goal, experience: Experience, exercise: Exercise): Scheme {
	const beginner = experience === "beginner";
	if (exercise.kind === "mobility") return { sets: 2, reps: 40, rest: 15 };
	if (exercise.timed) return { sets: beginner ? 2 : 3, reps: exercise.kind === "cardio" ? 40 : exercise.level >= 2 ? 35 : 30, rest: 30 };
	switch (goal) {
		case "get-stronger":
			return exercise.kind === "strength" ? { sets: beginner ? 3 : 4, reps: 5, rest: 120 } : { sets: 3, reps: 8, rest: 75 };
		case "build-muscle":
			return { sets: beginner ? 3 : 4, reps: 10, rest: 75 };
		case "lose-fat":
			return { sets: 3, reps: 14, rest: 45 };
		case "endurance":
			return { sets: 3, reps: 15, rest: 40 };
		default:
			return { sets: 3, reps: 12, rest: 60 };
	}
}

export function roundLoad(kg: number): number {
	return Math.max(2.5, Math.round(kg / 2.5) * 2.5);
}

export function startingWeight(exercise: Exercise, profile: Pick<Profile, "weightKg" | "experience">, mod = 1): number | undefined {
	if (!exercise.loadFactor) return undefined;
	const exp = profile.experience === "beginner" ? 0.7 : profile.experience === "advanced" ? 1.3 : 1;
	return roundLoad(profile.weightKg * exercise.loadFactor * exp * mod);
}

let blockCounter = 0;
export function nextBlockId(): string {
	blockCounter += 1;
	return `b${Date.now().toString(36)}${blockCounter}`;
}

export function buildBlock(exercise: Exercise, profile: Profile, mod = 1, override?: Partial<Scheme>): ExerciseBlock {
	const scheme = { ...schemeFor(profile.goal, profile.experience, exercise), ...override };
	const weight = startingWeight(exercise, profile, mod);
	const sets: SetEntry[] = Array.from({ length: scheme.sets }, () => ({ target: scheme.reps, targetWeight: weight, done: false }));
	return { id: nextBlockId(), exerciseId: exercise.id, restSec: scheme.rest, sets };
}

/** Rough session length in minutes for the sets that are still to do. */
export function estimateMinutes(blocks: ExerciseBlock[], warmupMin = 2): number {
	let seconds = 0;
	for (const block of blocks) {
		if (block.skipped) continue;
		const exercise = getExercise(block.exerciseId);
		const todo = block.sets.filter((s) => !s.done);
		todo.forEach((set, i) => {
			seconds += exercise.timed ? set.target : set.target * 3.5 + 8;
			if (i < todo.length - 1) seconds += block.restSec;
		});
		if (todo.length) seconds += 20; // transition between exercises
	}
	return Math.max(1, Math.round(seconds / 60 + warmupMin));
}

function pickCandidates(muscle: Muscle, profile: Profile, used: Set<string>): Exercise[] {
	const target = EXPERIENCE_LEVEL[profile.experience];
	return EXERCISES.filter((e) => e.muscle === muscle && isUsable(e, profile) && !used.has(e.id) && e.level <= Math.min(3, target + 1)).sort((a, b) => {
		const strengthBias = profile.goal === "get-stronger" || profile.goal === "build-muscle" ? Number(b.kind === "strength") - Number(a.kind === "strength") : 0;
		return strengthBias || Math.abs(a.level - target) - Math.abs(b.level - target) || a.id.localeCompare(b.id);
	});
}

function difficultyOf(profile: Profile, blocks: ExerciseBlock[]): PlannedWorkout["difficulty"] {
	const sets = blocks.reduce((n, b) => n + b.sets.length, 0);
	const score = EXPERIENCE_LEVEL[profile.experience] + (sets >= 16 ? 1 : 0) + (profile.goal === "get-stronger" ? 1 : 0);
	return Math.min(5, Math.max(1, score)) as PlannedWorkout["difficulty"];
}

function buildWorkout(date: ISODate, focus: Focus, occurrence: number, profile: Profile, mods: Record<string, number>): PlannedWorkout {
	const slots = focus.slots.slice(0, slotCount(profile.durationMin));
	if ((profile.goal === "lose-fat" || profile.goal === "endurance") && !slots.includes("cardio")) slots[slots.length - 1] = "cardio";
	if (profile.durationMin >= 30) slots.push("mobility");
	const used = new Set<string>();
	const blocks: ExerciseBlock[] = [];
	for (const muscle of slots) {
		const candidates = pickCandidates(muscle, profile, used);
		const pick = candidates[occurrence % Math.max(1, Math.min(2, candidates.length))];
		if (!pick) continue;
		used.add(pick.id);
		blocks.push(buildBlock(pick, profile, mods[pick.id] ?? 1));
	}
	const muscles = Array.from(new Set(slots.filter((m) => m !== "mobility")));
	return {
		id: `w-${date}`,
		date,
		title: focus.title,
		focus: muscles.slice(0, 3).map((m) => m[0]?.toUpperCase() + m.slice(1)).join(" · "),
		durationMin: estimateMinutes(blocks),
		difficulty: difficultyOf(profile, blocks),
		exercises: blocks,
		status: "planned",
	};
}

/** Builds planned sessions for `weeks` weeks starting at `from` (inclusive), following the user's training days. */
export function generatePlan(profile: Profile, from: ISODate, weeks = 4, mods: Record<string, number> = {}): PlannedWorkout[] {
	const focuses = focusesFor(profile.daysPerWeek);
	const days = DAY_PATTERNS[profile.daysPerWeek] ?? DAY_PATTERNS[3] ?? [];
	const out: PlannedWorkout[] = [];
	const start = mondayOf(from);
	let count = 0;
	for (let w = 0; w < weeks; w += 1) {
		for (const day of days) {
			const date = addDays(start, w * 7 + day);
			if (date < from) continue;
			const focus = focuses[count % focuses.length];
			if (!focus) continue;
			out.push(buildWorkout(date, focus, Math.floor(count / focuses.length), profile, mods));
			count += 1;
		}
	}
	return out;
}

/** An unscheduled short session for recovery days or when the user wants something extra. */
export function buildAdHocWorkout(kind: "mobility" | "cardio", date: ISODate, profile: Profile): PlannedWorkout {
	const muscles: Muscle[] = kind === "mobility" ? ["mobility", "mobility", "mobility", "core"] : ["cardio", "core", "cardio"];
	const used = new Set<string>();
	const blocks: ExerciseBlock[] = [];
	for (const muscle of muscles) {
		const pick = pickCandidates(muscle, { ...profile, experience: "beginner" }, used)[0];
		if (!pick) continue;
		used.add(pick.id);
		blocks.push(buildBlock(pick, profile, 1, { sets: 2, reps: kind === "mobility" ? 45 : 30, rest: 20 }));
	}
	return {
		id: `x-${date}-${kind}`,
		date,
		title: kind === "mobility" ? "Mobility & Recovery" : "Easy Cardio",
		focus: kind === "mobility" ? "Active recovery" : "Low intensity",
		durationMin: estimateMinutes(blocks),
		difficulty: 1,
		exercises: blocks,
		status: "planned",
		adHoc: true,
	};
}

export function nextUpcoming(planned: PlannedWorkout[], today: ISODate): PlannedWorkout | undefined {
	return planned.filter((w) => w.status === "planned" && w.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
}

export function isMissed(workout: PlannedWorkout, today: ISODate): boolean {
	return workout.status === "planned" && !workout.adHoc && daysBetween(workout.date, today) > 0;
}

export function weekdayOf(workout: PlannedWorkout): number {
	return weekdayIndex(workout.date);
}
