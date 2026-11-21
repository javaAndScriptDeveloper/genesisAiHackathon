import { findExercise } from "../fit/exercises";
import type { FitState, Perceived, PlannedWorkout } from "../fit/types";
import { consistencyScore } from "../fit/stats";
import { addDays, eachDay, weekStart } from "./dates";
import { insights, type Insight } from "./insights";
import type { CheckIn, Exercise, History, IsoDate, PlannedDay, Rpe, SetLog, WorkoutSession } from "./types";

const RPE: Record<Perceived, Rpe> = { easy: "easy", right: "ok", hard: "hard" };

function dayType(items: PlannedWorkout[]): PlannedDay["type"] {
	return items.some((w) => w.status !== "skipped" || w.skipReason === "busy") ? "workout" : "rest";
}

function buildPlan(planned: PlannedWorkout[]): PlannedDay[] {
	const regular = planned.filter((w) => !w.adHoc);
	if (regular.length === 0) return [];
	const byDate = new Map<IsoDate, PlannedWorkout[]>();
	for (const w of regular) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
	const dates = regular.map((w) => w.date).sort();
	const first = dates[0];
	const last = dates[dates.length - 1];
	if (first === undefined || last === undefined) return [];
	return eachDay(first, last).map((date) => ({ date, type: dayType(byDate.get(date) ?? []) }));
}

function buildCheckIns(state: Parameters<typeof historyFromFit>[0], today: IsoDate): CheckIn[] {
	const out: CheckIn[] = [];
	const seen = new Set<string>();
	state.bodyWeights.forEach((b, i) => {
		let id = `w:${b.at ?? b.date}`;
		if (seen.has(id)) id = `${id}:${i}`;
		seen.add(id);
		out.push({ id, kind: "weight", date: b.date, at: b.at ?? b.date, weightKg: b.kg });
	});
	if (state.goalWeightKg != null) {
		const setAt = state.goalSetAt ?? null;
		out.push({ id: `g:${setAt ?? "initial"}`, kind: "goal", date: setAt ? setAt.slice(0, 10) : today, at: setAt ?? today, goalKg: state.goalWeightKg });
	}
	for (const p of state.photos ?? []) {
		out.push({ id: `p:${p.id}`, kind: "photo", date: p.date, at: p.date, ...(p.weightKg !== undefined ? { weightKg: p.weightKg } : {}) });
	}
	return out;
}

/** Maps the app's real state onto the pure analytics model. Unknown exercise ids are dropped. */
export function historyFromFit(state: Pick<FitState, "planned" | "history" | "bodyWeights"> & Partial<Pick<FitState, "photos" | "goalWeightKg" | "goalSetAt">>, today: IsoDate): History {
	const plannedById = new Map(state.planned.map((w) => [w.id, w]));
	const weighted = new Set<string>();
	const used = new Map<string, Exercise>();

	const sessions: WorkoutSession[] = state.history.map((log) => {
		const plan = log.plannedId ? plannedById.get(log.plannedId) : undefined;
		const sets: SetLog[] = [];
		let logged = 0;
		for (const ex of log.exercises) {
			if (ex.skipped) continue;
			const info = findExercise(ex.exerciseId);
			if (!info) continue;
			for (const set of ex.sets) {
				logged += 1;
				if (info.timed) {
					sets.push({ exerciseId: ex.exerciseId, reps: 0, weightKg: null, durationSec: set.reps });
				} else {
					if (set.weight !== undefined) weighted.add(ex.exerciseId);
					sets.push({ exerciseId: ex.exerciseId, reps: set.reps, weightKg: set.weight ?? null, durationSec: null });
				}
			}
			used.set(ex.exerciseId, {
				id: ex.exerciseId,
				name: info.name,
				kind: info.timed ? "timed" : "bodyweight",
			});
		}
		const regular = plan !== undefined && !plan.adHoc ? plan : undefined;
		const plannedSets = regular ? regular.exercises.reduce((n, b) => n + b.sets.length, 0) : 0;
		// lib/fit credits the planned workout (even when done on another day); a partial/completed one counts as quality.
		const credited = regular !== undefined && (regular.status === "partial" || regular.status === "completed");
		return {
			id: log.id,
			date: regular ? regular.date : log.date,
			planned: regular !== undefined,
			status: "completed",
			adapted: log.adaptations.length > 0,
			durationMin: Math.round(log.durationSec / 60),
			setsPlanned: Math.max(1, credited ? Math.min(plannedSets || logged, logged) : plannedSets || logged),
			sets,
			rpe: RPE[log.perceived],
		};
	});

	const exercises = [...used.values()].map((e): Exercise => (e.kind === "bodyweight" && weighted.has(e.id) ? { ...e, kind: "weighted" } : e));

	return {
		today,
		exercises,
		plan: buildPlan(state.planned),
		sessions,
		body: state.bodyWeights.map((b) => ({ date: b.date, weightKg: b.kg })),
		checkIns: buildCheckIns(state, today),
		device: null,
	};
}

/** Whether the 4-week consistency window ending on `day` (same window as fit/stats) has regular planned sessions. */
export function hasPlanWindow(planned: PlannedWorkout[], day: IsoDate): boolean {
	const start = addDays(weekStart(day), -21);
	return planned.some((w) => !w.adHoc && w.date >= start && w.date <= day);
}

/** Mondays of full weeks that have a plan entry, newest first, at most 8. */
export function reportWeeksOf(history: History): IsoDate[] {
	const current = weekStart(history.today);
	const weeks = new Set<IsoDate>();
	for (const p of history.plan) {
		const monday = weekStart(p.date);
		if (monday < current) weeks.add(monday);
	}
	return [...weeks].sort().reverse().slice(0, 8);
}

/**
 * Insights for the app screen. The "consistency up" hint uses the same delta as the consistency badge
 * (the app's own score), so the two can never contradict each other.
 */
export function appInsights(h: History, consistencyDelta: number | null, limit = 2): Insight[] {
	const list = insights(h, 4).filter((i) => i.id !== "consistency_up");
	if (consistencyDelta !== null && consistencyDelta > 0) list.push({ id: "consistency_up", vars: { delta: consistencyDelta } });
	return list.slice(0, limit);
}

/** Change in the app's consistency score over the last 7 days; the week-ago score only sees workouts up to that day. */
export function consistencyDeltaOf(planned: PlannedWorkout[], today: IsoDate): number | null {
	const weekAgo = addDays(today, -7);
	const past = planned.filter((w) => w.date <= weekAgo);
	if (!hasPlanWindow(planned, today) && !hasPlanWindow(past, weekAgo)) return null;
	return consistencyScore(planned, today) - consistencyScore(past, weekAgo);
}
