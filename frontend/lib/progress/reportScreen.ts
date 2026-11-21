import type { Advice, Improvement } from "./improvements";
import { weeklyReportV2, type WeekTotals, type WeeklyReportV2 } from "./report";
import type { Exercise, History, IsoDate, ProgressContext } from "./types";

/** Report of a past week graded with the goal captured when the screen opened, so a later goal change never re-grades it. */
export function reportView(h: History, ctx: ProgressContext, week: IsoDate, frozenGoal: number): WeeklyReportV2 {
	return weeklyReportV2(h, { ...ctx, weeklyGoal: frozenGoal }, week);
}

export type ComparisonMetric = "workouts" | "minutes" | "qualitySets" | "xp";

export interface ComparisonRow {
	metric: ComparisonMetric;
	now: number;
	before: number;
	delta: number;
	direction: "up" | "down" | "same";
	/** Only increases are highlighted; decreases and no change are always neutral (never warning-styled). */
	tone: "positive" | "neutral";
}

const METRICS: ComparisonMetric[] = ["workouts", "minutes", "qualitySets", "xp"];

export function comparisonRows(now: WeekTotals, before: WeekTotals): ComparisonRow[] {
	return METRICS.map((metric) => {
		const delta = now[metric] - before[metric];
		const direction = delta > 0 ? "up" : delta < 0 ? "down" : "same";
		return { metric, now: now[metric], before: before[metric], delta, direction, tone: direction === "up" ? "positive" : "neutral" };
	});
}

export interface GoalOption {
	value: number;
	recommended: boolean;
	selected: boolean;
}

/** Goal choices 2..5; the recommended one is marked, the currently set one is selected. */
export function goalOptions(recommended: number, current: number): GoalOption[] {
	return [2, 3, 4, 5].map((value) => ({ value, recommended: value === recommended, selected: value === current }));
}

type Params = Record<string, string | number>;
export interface Copy {
	key: string;
	params: Params;
}

/** Copy key and params for the improvement; `fmt` formats a kilogram value in the user's unit. */
export function improvementCopy(i: Improvement, exercises: Exercise[], fmt: (kg: number) => string): Copy {
	if (i.kind === "record") {
		const ex = exercises.find((e) => e.id === i.exerciseId);
		const f = (v: number): string => (i.metric === "reps" ? String(v) : i.metric === "time" ? `${v} s` : fmt(v));
		return { key: "fit.progress.improvements.record", params: { exercise: ex?.name ?? i.exerciseId, before: f(i.before), now: f(i.now), delta: f(i.delta) } };
	}
	return { key: `fit.progress.improvements.${i.kind}`, params: { before: i.before, now: i.now, delta: i.delta } };
}

export function adviceCopy(a: Advice, exercises: Exercise[], fmt: (kg: number) => string): Copy {
	const params: Params = { ...a.vars };
	if (a.id === "near-record") {
		const kind = exercises.find((e) => e.id === a.vars.exerciseId)?.kind;
		const target = Number(a.vars.target);
		params.target = kind === "weighted" ? fmt(target) : kind === "timed" ? `${target} s` : target;
	}
	const one = a.id === "goal-remaining" && Number(a.vars.n) === 1;
	return { key: `fit.progress.advice.${one ? "goal-remaining-one" : a.id}`, params };
}
