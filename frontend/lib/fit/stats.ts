import { addDays, daysBetween, mondayOf, weekKey, type ISODate } from "./dates";
import { getExercise } from "./exercises";
import { roundLoad } from "./plan";
import type { ExerciseBlock, LoggedExercise, PlannedWorkout, Profile, SessionLog } from "./types";

export function volumeOf(exercises: LoggedExercise[]): number {
	let total = 0;
	for (const ex of exercises) for (const set of ex.sets) if (set.weight) total += set.weight * set.reps;
	return Math.round(total);
}

export interface WeekStats {
	planned: number;
	done: number;
	minutes: number;
	volume: number;
	/** Sessions still ahead (today or later). */
	remaining: number;
}

export function weekStats(planned: PlannedWorkout[], history: SessionLog[], today: ISODate, weekOffset = 0): WeekStats {
	const start = addDays(mondayOf(today), weekOffset * 7);
	const end = addDays(start, 6);
	const plan = planned.filter((w) => !w.adHoc && w.date >= start && w.date <= end);
	const logs = history.filter((l) => l.date >= start && l.date <= end);
	return {
		planned: plan.length,
		done: plan.filter((w) => w.status === "completed" || w.status === "partial").length,
		minutes: Math.round(logs.reduce((n, l) => n + l.durationSec, 0) / 60),
		volume: logs.reduce((n, l) => n + l.volumeKg, 0),
		remaining: plan.filter((w) => w.status === "planned" && w.date >= today).length,
	};
}

/** Share of planned sessions finished over the last `weeks` weeks. Recovery and illness skips are excused. */
export function consistencyScore(planned: PlannedWorkout[], today: ISODate, weeks = 4): number {
	const start = addDays(mondayOf(today), -(weeks - 1) * 7);
	const due = planned.filter((w) => !w.adHoc && w.date >= start && (w.date < today || w.status !== "planned"));
	const counted = due.filter((w) => !(w.status === "skipped" && w.skipReason !== "busy"));
	if (counted.length === 0) return 0;
	const done = counted.filter((w) => w.status === "completed" || w.status === "partial").length;
	return Math.round((done / counted.length) * 100);
}

export interface StreakInfo {
	current: number;
	longest: number;
}

/**
 * Streak counts consecutive planned sessions completed. Rest days never matter, and a skip for recovery or
 * illness is neutral (it neither adds nor breaks). Only a missed or "busy" skip resets it. Extra sessions never count.
 */
export function computeStreak(planned: PlannedWorkout[], today: ISODate): StreakInfo {
	const relevant = planned.filter((w) => !w.adHoc && (w.status !== "planned" || w.date < today)).sort((a, b) => a.date.localeCompare(b.date));
	let current = 0;
	let longest = 0;
	for (const w of relevant) {
		if (w.status === "completed" || w.status === "partial") current += 1;
		else if (w.status === "skipped" && w.skipReason !== "busy") continue;
		else current = 0;
		longest = Math.max(longest, current);
	}
	return { current, longest };
}

export interface RecordEntry {
	exerciseId: string;
	best: number;
	unit: "kg" | "reps" | "s";
	date: ISODate;
}

function metricOf(exerciseId: string, set: { reps: number; weight?: number }): { value: number; unit: RecordEntry["unit"] } {
	const exercise = getExercise(exerciseId);
	if (set.weight) return { value: set.weight, unit: "kg" };
	return { value: set.reps, unit: exercise.timed ? "s" : "reps" };
}

export function personalRecords(history: SessionLog[]): RecordEntry[] {
	const best = new Map<string, RecordEntry>();
	for (const log of [...history].sort((a, b) => a.date.localeCompare(b.date))) {
		for (const ex of log.exercises) {
			for (const set of ex.sets) {
				const { value, unit } = metricOf(ex.exerciseId, set);
				const current = best.get(ex.exerciseId);
				if (!current || value > current.best) best.set(ex.exerciseId, { exerciseId: ex.exerciseId, best: value, unit, date: log.date });
			}
		}
	}
	return [...best.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Names of exercises where this session beat everything logged before it. Needs an earlier baseline. */
export function detectPrs(history: SessionLog[], exercises: LoggedExercise[]): string[] {
	const prior = new Map(personalRecords(history).map((r) => [r.exerciseId, r.best]));
	const prs: string[] = [];
	for (const ex of exercises) {
		const before = prior.get(ex.exerciseId);
		if (before === undefined || ex.sets.length === 0) continue;
		const top = Math.max(...ex.sets.map((s) => metricOf(ex.exerciseId, s).value));
		if (top > before) prs.push(getExercise(ex.exerciseId).name);
	}
	return prs;
}

/** Next target load from the last performed one. Always moves by at least one plate step in the requested direction. */
export function nextTarget(last: number, factor: number): number {
	const rounded = roundLoad(last * factor);
	if (factor > 1 && rounded <= last) return last + 2.5;
	if (factor < 1 && rounded >= last) return Math.max(2.5, last - 2.5);
	return rounded;
}

export function progressionFactor(perceived: SessionLog["perceived"], hitAllTargets: boolean): number {
	if (perceived === "hard") return 0.95;
	if (perceived === "easy") return 1.05;
	return hitAllTargets ? 1.025 : 1;
}

/** Push each exercise's latest performance into upcoming planned sessions (target loads only, never done sets). */
export function applyProgression(planned: PlannedWorkout[], log: SessionLog, today: ISODate): PlannedWorkout[] {
	const factors = new Map<string, number>();
	for (const ex of log.exercises) {
		const weights = ex.sets.map((s) => s.weight).filter((w): w is number => typeof w === "number");
		if (ex.skipped || weights.length === 0) continue;
		const last = Math.max(...weights);
		factors.set(ex.exerciseId, nextTarget(last, progressionFactor(log.perceived, log.status === "completed")));
	}
	return planned.map((w) => {
		if (w.status !== "planned" || w.date <= log.date || w.date < today) return w;
		const exercises: ExerciseBlock[] = w.exercises.map((b) => {
			const target = factors.get(b.exerciseId);
			if (target === undefined) return b;
			return { ...b, sets: b.sets.map((s) => (s.done ? s : { ...s, targetWeight: target })) };
		});
		return { ...w, exercises };
	});
}

export function sessionXp(args: { status: "completed" | "partial"; durationSec: number; prs: number; adHocExtra: boolean }): number {
	const base = args.status === "completed" ? 60 : 30;
	const minutes = Math.min(60, Math.round(args.durationSec / 60));
	const raw = base + minutes + args.prs * 15;
	return Math.round(args.adHocExtra ? raw * 0.25 : raw);
}

export function levelInfo(xp: number): { level: number; into: number; span: number; pct: number } {
	const level = Math.floor(Math.sqrt(xp / 100)) + 1;
	const floor = 100 * (level - 1) ** 2;
	const ceil = 100 * level ** 2;
	return { level, into: xp - floor, span: ceil - floor, pct: Math.round(((xp - floor) / (ceil - floor)) * 100) };
}

export function mean(values: number[]): number {
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function historyByWeek(history: SessionLog[], today: ISODate, weeks: number): { label: string; key: string; volume: number; sessions: number; minutes: number }[] {
	const out: { label: string; key: string; volume: number; sessions: number; minutes: number }[] = [];
	for (let i = weeks - 1; i >= 0; i -= 1) {
		const start = addDays(mondayOf(today), -i * 7);
		const end = addDays(start, 6);
		const logs = history.filter((l) => l.date >= start && l.date <= end);
		out.push({
			label: i === 0 ? "This wk" : `${start.slice(5).replace("-", "/")}`,
			key: weekKey(start),
			volume: logs.reduce((n, l) => n + l.volumeKg, 0),
			sessions: logs.length,
			minutes: Math.round(logs.reduce((n, l) => n + l.durationSec, 0) / 60),
		});
	}
	return out;
}

export function daysSinceLastWorkout(history: SessionLog[], today: ISODate): number | null {
	const last = history.map((l) => l.date).sort().pop();
	return last ? daysBetween(last, today) : null;
}

export function bmi(profile: Pick<Profile, "heightCm" | "weightKg">): number {
	const m = profile.heightCm / 100;
	return Math.round((profile.weightKg / (m * m)) * 10) / 10;
}
