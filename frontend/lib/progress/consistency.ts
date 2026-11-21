import { addDays, eachDay, weekStart } from "./dates";
import { dayStatus } from "./days";
import type { DayStatus, History, IsoDate } from "./types";

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
