import { addDays, weekday } from "./dates";
import { effectiveGoal, isPausedWeek, streakV2, weekCredited, weeklyGoal, type WeekGoal } from "./consistency";
import { isQualitySession, truncateHistory } from "./days";
import { advice, improvements, type Advice, type Improvement } from "./improvements";
import { insights, type Insight } from "./insights";
import { personalRecords, type PersonalRecord } from "./records";
import { periodSummary, type PeriodSummary } from "./summary";
import { xpLedger } from "./xp";
import type { History, IsoDate, ProgressContext, WorkoutSession } from "./types";

export interface WeeklyReport {
	summary: PeriodSummary;
	previous: PeriodSummary;
	records: PersonalRecord[];
	insight: Insight | null;
	nextWeek: WeekGoal;
}

/** A report week is a real Monday whose Sunday is already in the past. */
export function isValidReportWeek(week: string, today: IsoDate): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return false;
	const d = new Date(`${week}T00:00:00Z`);
	if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== week) return false;
	return weekday(week) === 0 && addDays(week, 6) < today;
}

export function weeklyReport(h: History, week: IsoDate): WeeklyReport {
	const end = addDays(week, 6);
	const prev = addDays(week, -7);
	return {
		summary: periodSummary(h, week, end),
		previous: periodSummary(h, prev, addDays(prev, 6)),
		records: personalRecords(h).filter((r) => r.date >= week && r.date <= end),
		// consistency_up uses a different metric than the app's consistency ring, so it is left out of reports.
		insight: insights({ ...h, today: end }, 4).find((i) => i.id !== "consistency_up") ?? null,
		nextWeek: weeklyGoal(h, addDays(week, 7)),
	};
}

export interface WeekTotals {
	workouts: number;
	minutes: number;
	qualitySets: number;
	xp: number;
}

export interface WeeklyReportV2 {
	weekStart: IsoDate;
	credited: boolean;
	paused: boolean;
	summary: WeekTotals;
	previous: WeekTotals;
	improvement: Improvement | null;
	advice: Advice | null;
	recommendedGoal: number; // 2..5
	pushText: { key: "fit.progress.push.weekly"; params: { done: number; goal: number; streak: number } };
}

const clampGoal = (n: number): number => Math.min(5, Math.max(2, n));

const inWeek = (s: WorkoutSession, ws: IsoDate): boolean => s.date >= ws && s.date <= addDays(ws, 6);

const qualityCount = (h: History, ws: IsoDate): number => h.sessions.filter((s) => inWeek(s, ws) && isQualitySession(s)).length;

function totals(h: History, ctx: ProgressContext, ws: IsoDate): WeekTotals {
	const end = addDays(ws, 6);
	const week = h.sessions.filter((s) => inWeek(s, ws));
	const quality = week.filter(isQualitySession);
	return {
		workouts: qualityCount(h, ws),
		minutes: week.filter((s) => s.status === "completed").reduce((a, s) => a + s.durationMin, 0),
		qualitySets: quality.reduce((a, s) => a + s.sets.length, 0),
		xp: xpLedger(h, ctx).filter((e) => e.date >= ws && e.date <= end).reduce((a, e) => a + e.amount, 0),
	};
}

export function weeklyReportV2(h: History, ctx: ProgressContext, weekStart: IsoDate): WeeklyReportV2 {
	const t = truncateHistory(h, addDays(weekStart, 6));
	const paused = isPausedWeek(ctx, weekStart);
	const summary = totals(t, ctx, weekStart);

	// Mean quality sessions over up to 4 finished, non-paused weeks, newest first. A paused report week is not
	// seeded; older weeks are pulled in instead. No eligible weeks -> the minimum goal.
	const counts: number[] = [];
	if (!paused) counts.push(summary.workouts);
	for (let ws = addDays(weekStart, -7); counts.length < 4 && t.sessions.some((s) => s.date <= addDays(ws, 6)); ws = addDays(ws, -7)) {
		if (isPausedWeek(ctx, ws)) continue;
		counts.push(qualityCount(t, ws));
	}
	const recommendedGoal = counts.length === 0 ? 2 : clampGoal(Math.round(counts.reduce((a, b) => a + b, 0) / counts.length));

	return {
		weekStart,
		credited: !paused && weekCredited(t, ctx, weekStart),
		paused,
		summary,
		previous: totals(t, ctx, addDays(weekStart, -7)),
		improvement: improvements(t, ctx)[0] ?? null,
		advice: advice(t, ctx),
		recommendedGoal,
		pushText: {
			key: "fit.progress.push.weekly",
			params: { done: summary.workouts, goal: effectiveGoal(ctx), streak: streakV2(t, ctx).current },
		},
	};
}
