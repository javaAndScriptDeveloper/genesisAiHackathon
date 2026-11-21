import { findExercise } from "../fit/exercises";
import type { FitState, Perceived, PlannedWorkout } from "../fit/types";
import { addDays, eachDay, weekStart } from "./dates";
import { insights, type Insight } from "./insights";
import type { Exercise, History, IsoDate, PlannedDay, Rpe, SetLog, WorkoutSession } from "./types";

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

/** Maps the app's real state onto the pure analytics model. Unknown exercise ids are dropped. */
export function historyFromFit(state: Pick<FitState, "planned" | "history" | "bodyWeights">, today: IsoDate): History {
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
		const plannedSets = plan ? plan.exercises.reduce((n, b) => n + b.sets.length, 0) : 0;
		return {
			id: log.id,
			date: log.date,
			planned: plan !== undefined && !plan.adHoc,
			status: "completed",
			adapted: log.adaptations.length > 0,
			durationMin: Math.round(log.durationSec / 60),
			setsPlanned: Math.max(1, plannedSets || logged),
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
