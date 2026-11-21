import type { ExerciseKind, History, IsoDate, SetLog, WorkoutSession } from "./types";

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

const roundHalf = (x: number): number => Math.round(x * 2) / 2;

export function estimate1RM(weightKg: number, reps: number): number | null {
	if (reps < 1 || reps > 10) return null;
	return roundHalf(weightKg * (1 + reps / 30));
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

export function exerciseSeries(h: History, exerciseId: string): SeriesPoint[] {
	const kind = h.exercises.find((e) => e.id === exerciseId)?.kind;
	if (!kind) return [];
	const done = chronological(h);
	let main = mainMetric(kind);
	// One metric per exercise: e1RM if any set ever qualifies, otherwise max weight (never a mix).
	if (kind === "weighted" && !done.some((s) => metricValue(s.sets.filter((x) => x.exerciseId === exerciseId), "e1rm") !== null)) main = "weight";
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
