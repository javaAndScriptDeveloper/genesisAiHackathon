import { addDays, daysBetween, eachDay, weekStart } from "./dates";
import { dayStatus, isQualitySession } from "./days";
import type { DayStatus, History, IsoDate, ProgressContext } from "./types";

export interface Consistency {
	score: number | null;
	delta: number | null;
	fullWeeks: number;
}

export interface WeekGoalDay {
	date: IsoDate;
	type: "workout" | "rest";
	status: DayStatus;
}

export interface WeekGoal {
	weekStart: IsoDate;
	days: WeekGoalDay[];
	done: number;
	planned: number;
}

const WEIGHTS = [0.4, 0.3, 0.2, 0.1] as const;

const isDone = (s: DayStatus): boolean => s === "completed" || s === "adapted";

export function isRestKept(h: History, date: IsoDate): boolean {
	const entry = h.plan.find((p) => p.date === date);
	if (!entry || entry.type !== "rest" || date > h.today) return false;
	return !h.sessions.some((s) => s.date === date);
}

/** Week ratio, or null when the week has no plan entries. */
function weekRatio(h: History, ws: IsoDate): number | null {
	const days = eachDay(ws, addDays(ws, 6));
	let planned = 0;
	let good = 0;
	for (const d of days) {
		const entry = h.plan.find((p) => p.date === d);
		if (!entry) continue;
		planned++;
		if (entry.type === "workout" ? isDone(dayStatus(h, d)) : isRestKept(h, d)) good++;
	}
	return planned === 0 ? null : good / planned;
}

function earliestPlan(h: History): IsoDate | null {
	return h.plan.reduce<IsoDate | null>((min, p) => (min === null || p.date < min ? p.date : min), null);
}

function score(h: History): { score: number | null; fullWeeks: number } {
	const earliest = earliestPlan(h);
	if (earliest === null) return { score: null, fullWeeks: 0 };
	const ratios: number[] = [];
	for (let ws = addDays(weekStart(h.today), -7); ws >= weekStart(earliest) && ratios.length < WEIGHTS.length; ws = addDays(ws, -7)) {
		const r = weekRatio(h, ws);
		if (r !== null) ratios.push(r);
	}
	if (ratios.length === 0) return { score: null, fullWeeks: 0 };
	let total = 0;
	let weightSum = 0;
	ratios.forEach((r, i) => {
		const w = WEIGHTS[i] ?? 0;
		total += w * r;
		weightSum += w;
	});
	return { score: Math.round((100 * total) / weightSum), fullWeeks: ratios.length };
}

export function consistencyScore(h: History): Consistency {
	const now = score(h);
	const before = score({ ...h, today: addDays(h.today, -7) });
	const delta = now.score === null || before.score === null ? null : now.score - before.score;
	return { score: now.score, delta, fullWeeks: now.fullWeeks };
}

export function weeklyGoal(h: History, weekStartDate?: IsoDate): WeekGoal {
	const start = weekStartDate ?? weekStart(h.today);
	const days: WeekGoalDay[] = [];
	for (const date of eachDay(start, addDays(start, 6))) {
		const entry = h.plan.find((p) => p.date === date);
		if (entry) days.push({ date, type: entry.type, status: dayStatus(h, date) });
		else days.push({ date, type: "rest", status: "none" });
	}
	return {
		weekStart: start,
		days,
		done: days.filter((d) => isDone(d.status)).length,
		planned: days.filter((d) => d.type === "workout" && d.status !== "none").length,
	};
}

/** True when the week has workout days and all of them are done. */
function weekAllDone(h: History, ws: IsoDate): boolean {
	const workouts = weeklyGoal(h, ws).days.filter((d) => d.type === "workout" && d.status !== "none");
	return workouts.length > 0 && workouts.every((d) => isDone(d.status));
}

// Not used by the app UI — the app's streak lives in lib/fit (see docs/agent/fitness-app.md, ruling R7). Kept as tested reference.
export function streakWeeks(h: History): number {
	const current = weekStart(h.today);
	let streak = weekAllDone(h, current) ? 1 : 0;
	for (let ws = addDays(current, -7); weekAllDone(h, ws); ws = addDays(ws, -7)) streak++;
	return streak;
}

// ---- v2 ----

const WEIGHTS_V2 = [0.4, 0.3, 0.2, 0.1] as const;
/** A pause covers at most 4 weeks: to − from ≤ 27 days. */
export const MAX_PAUSE_DAYS = 27;

const hasQuality = (h: History, date: IsoDate): boolean => h.sessions.some((s) => s.date === date && isQualitySession(s));

/** Nearest planned training day of the same week as `date` (tie → prefer a quality-completed one), or null. */
export function nearestTrainingDay(h: History, date: IsoDate): IsoDate | null {
	const ws = weekStart(date);
	let best: IsoDate | null = null;
	let bestDist = Infinity;
	for (const d of eachDay(ws, addDays(ws, 6))) {
		if (h.plan.find((p) => p.date === d)?.type !== "workout") continue;
		const dist = Math.abs(daysBetween(date, d));
		// tie → either; prefer a quality-completed one
		if (dist < bestDist || (dist === bestDist && best !== null && !hasQuality(h, best) && hasQuality(h, d))) {
			best = d;
			bestDist = dist;
		}
	}
	return best;
}

/** Rest day is credited when the nearest planned training day of the same week was quality-completed. */
export function restDayCredited(h: History, date: IsoDate): boolean {
	const entry = h.plan.find((p) => p.date === date);
	if (!entry || entry.type !== "rest") return false;
	const best = nearestTrainingDay(h, date);
	return best !== null && hasQuality(h, best);
}

/** C_week in 0..100, or null when the week has no plan entries. */
export function weekScore(h: History, ws: IsoDate): number | null {
	let planned = 0;
	let good = 0;
	for (const d of eachDay(ws, addDays(ws, 6))) {
		const entry = h.plan.find((p) => p.date === d);
		if (!entry) continue;
		planned++;
		if (entry.type === "workout" ? hasQuality(h, d) : restDayCredited(h, d)) good++;
	}
	return planned === 0 ? null : Math.min(100, Math.round((good / planned) * 100));
}

export function isPausedWeek(ctx: ProgressContext, ws: IsoDate): boolean {
	const end = addDays(ws, 6);
	return ctx.pauses.some((p) => {
		const len = daysBetween(p.from, p.to);
		return len >= 0 && len <= MAX_PAUSE_DAYS && p.from <= end && p.to >= ws;
	});
}

function earliestActivity(h: History): IsoDate | null {
	const dates = [...h.plan.map((p) => p.date), ...h.sessions.map((s) => s.date)];
	return dates.reduce<IsoDate | null>((min, d) => (min === null || d < min ? d : min), null);
}

export function consistencyV2(
	h: History,
	ctx: ProgressContext,
): { score: number | null; weeks: { weekStart: IsoDate; score: number; weight: number }[] } {
	const earliest = earliestActivity(h);
	if (earliest === null) return { score: null, weeks: [] };
	const found: { weekStart: IsoDate; score: number }[] = [];
	for (let ws = addDays(weekStart(h.today), -7); ws >= weekStart(earliest) && found.length < WEIGHTS_V2.length; ws = addDays(ws, -7)) {
		if (isPausedWeek(ctx, ws)) continue;
		const s = weekScore(h, ws);
		if (s !== null) found.push({ weekStart: ws, score: s });
	}
	if (found.length === 0) return { score: null, weeks: [] };
	const sum = WEIGHTS_V2.slice(0, found.length).reduce((a, b) => a + b, 0);
	const weeks = found.map((w, i) => ({ ...w, weight: Math.round(((WEIGHTS_V2[i] ?? 0) / sum) * 1e6) / 1e6 }));
	const score = Math.round(weeks.reduce((a, w) => a + w.score * w.weight, 0));
	return { score, weeks };
}

export function weekCredited(h: History, ctx: ProgressContext, ws: IsoDate): boolean {
	const goal = Math.min(5, Math.max(2, ctx.weeklyGoal));
	const end = addDays(ws, 6);
	return h.sessions.filter((s) => s.date >= ws && s.date <= end && isQualitySession(s)).length >= goal;
}

export function streakV2(h: History, ctx: ProgressContext): { current: number; best: number } {
	const earliest = earliestActivity(h);
	if (earliest === null) return { current: 0, best: 0 };
	const currentWs = weekStart(h.today);
	let current = 0;
	let best = 0;
	for (let ws = weekStart(earliest); ws <= currentWs; ws = addDays(ws, 7)) {
		if (isPausedWeek(ctx, ws)) continue; // pause: streak neither grows nor resets
		if (weekCredited(h, ctx, ws)) current++;
		else if (ws < currentWs) current = 0;
		best = Math.max(best, current);
	}
	return { current, best };
}
