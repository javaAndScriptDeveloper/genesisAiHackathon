import type { Exercise, ExerciseKind, History, IsoDate, SetLog, WorkoutSession } from "./types";

export type RecordMetric = "weight" | "e1rm" | "reps" | "time";
export interface PersonalRecord {
	exerciseId: string;
	metric: RecordMetric;
	value: number;
	previous: number;
	date: IsoDate;
	sessionId: string;
}
export interface SeriesPoint {
	date: IsoDate;
	value: number;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Brzycki estimate: w × 36 / (37 − r), valid for 1..10 reps, rounded to 0.1 kg. */
export function estimate1RM(weightKg: number, reps: number): number | null {
	if (!Number.isInteger(reps) || reps < 1 || reps > 10) return null;
	return round1((weightKg * 36) / (37 - reps));
}

export function mainMetric(kind: ExerciseKind): RecordMetric {
	return kind === "weighted" ? "e1rm" : kind === "bodyweight" ? "reps" : "time";
}

function maxOf(values: number[]): number | null {
	return values.length === 0 ? null : Math.max(...values);
}

function weights(sets: SetLog[]): number[] {
	return sets.flatMap((s) => (s.weightKg === null ? [] : [s.weightKg]));
}

function metricValue(sets: SetLog[], metric: RecordMetric): number | null {
	switch (metric) {
		case "weight":
			return maxOf(weights(sets));
		case "e1rm":
			return maxOf(
				sets.flatMap((s) => {
					if (s.weightKg === null) return [];
					const e = estimate1RM(s.weightKg, s.reps);
					return e === null ? [] : [e];
				}),
			);
		case "reps":
			return maxOf(sets.map((s) => s.reps));
		case "time":
			return maxOf(sets.flatMap((s) => (s.durationSec === null ? [] : [s.durationSec])));
	}
}

function chronological(h: History): WorkoutSession[] {
	return h.sessions
		.filter((s) => s.status === "completed")
		.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
}

/** One metric per exercise: e1RM if any set ever qualifies, otherwise max weight (never a mix). */
export function exerciseMetric(h: History, ex: Exercise): RecordMetric {
	if (ex.kind !== "weighted") return mainMetric(ex.kind);
	const anyE1rm = chronological(h).some((s) => metricValue(s.sets.filter((x) => x.exerciseId === ex.id), "e1rm") !== null);
	return anyE1rm ? "e1rm" : "weight";
}

export function exerciseSeries(h: History, exerciseId: string): SeriesPoint[] {
	const ex = h.exercises.find((e) => e.id === exerciseId);
	if (!ex) return [];
	const done = chronological(h);
	const main = exerciseMetric(h, ex);
	const points: SeriesPoint[] = [];
	for (const s of done) {
		const sets = s.sets.filter((x) => x.exerciseId === exerciseId);
		if (sets.length === 0) continue;
		const value = metricValue(sets, main);
		if (value !== null) points.push({ date: s.date, value });
	}
	return points;
}

function metricsFor(kind: ExerciseKind): RecordMetric[] {
	return kind === "weighted" ? ["weight", "e1rm"] : [mainMetric(kind)];
}

export function personalRecords(h: History): PersonalRecord[] {
	const best = new Map<string, number>();
	const out: PersonalRecord[] = [];
	for (const s of chronological(h)) {
		const exIds = [...new Set(s.sets.map((x) => x.exerciseId))];
		for (const exerciseId of exIds) {
			const kind = h.exercises.find((e) => e.id === exerciseId)?.kind;
			if (!kind) continue;
			const sets = s.sets.filter((x) => x.exerciseId === exerciseId);
			for (const metric of metricsFor(kind)) {
				const value = metricValue(sets, metric);
				if (value === null) continue;
				const key = `${exerciseId}:${metric}`;
				const previous = best.get(key);
				if (previous !== undefined && value > previous) {
					out.push({ exerciseId, metric, value, previous, date: s.date, sessionId: s.id });
				}
				if (previous === undefined || value > previous) best.set(key, value);
			}
		}
	}
	return out;
}

export interface SetRecord {
	reps: 5 | 8 | 10;
	weightKg: number;
	date: IsoDate;
}

const SET_RECORD_REPS = [5, 8, 10] as const;

/** Heaviest weight lifted for exactly 5, 8 and 10 reps (completed sessions), dated by first achievement. */
export function setRecords(h: History, exerciseId: string): SetRecord[] {
	const best = new Map<number, SetRecord>();
	for (const s of chronological(h)) {
		for (const set of s.sets) {
			if (set.exerciseId !== exerciseId || set.weightKg === null) continue;
			const reps = SET_RECORD_REPS.find((r) => r === set.reps);
			if (reps === undefined) continue;
			const cur = best.get(reps);
			if (!cur || set.weightKg > cur.weightKg) best.set(reps, { reps, weightKg: set.weightKg, date: s.date });
		}
	}
	return SET_RECORD_REPS.flatMap((r) => {
		const x = best.get(r);
		return x ? [x] : [];
	});
}
