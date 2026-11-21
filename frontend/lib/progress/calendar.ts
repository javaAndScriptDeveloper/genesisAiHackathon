import { consistencyV2, effectiveGoal, isPausedWeek, nearestTrainingDay, restDayCredited, weekCredited, weekScore } from "./consistency";
import { addDays, eachDay, weekStart } from "./dates";
import { isQualitySession } from "./days";
import type { History, IsoDate, ProgressContext, WorkoutSession } from "./types";

export type CalendarDayState = "training-done" | "rest-credited" | "rest" | "missed" | "paused" | "planned" | "today" | "none";

export interface CalendarDay {
	date: IsoDate;
	inMonth: boolean;
	state: CalendarDayState;
	isToday: boolean;
}

export interface CalendarWeekSummary {
	credited: boolean;
	paused: boolean;
	current: boolean;
	/** C_week for weeks up to the current one, null for future weeks or weeks without a plan. */
	score: number | null;
}

export interface CalendarWeek {
	weekStart: IsoDate;
	days: CalendarDay[];
	week: CalendarWeekSummary;
}

export interface CalendarMonth {
	month: string;
	weeks: CalendarWeek[];
}

const MONTH_RE = /^(\d{4})-(\d{2})$/;

export function isValidMonth(month: string): boolean {
	const m = MONTH_RE.exec(month);
	return m !== null && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function monthOf(date: IsoDate): string {
	return date.slice(0, 7);
}

/** Shift a `YYYY-MM` month by n months. */
export function shiftMonth(month: string, n: number): string {
	const [y = 1970, m = 1] = month.split("-").map(Number);
	const total = y * 12 + (m - 1) + n;
	const year = Math.floor(total / 12);
	const mon = total - year * 12 + 1;
	return `${String(year).padStart(4, "0")}-${String(mon).padStart(2, "0")}`;
}

function lastDayOfMonth(month: string): IsoDate {
	return addDays(`${shiftMonth(month, 1)}-01`, -1);
}

export function inPause(ctx: ProgressContext, date: IsoDate): boolean {
	return ctx.pauses.some((p) => p.from <= date && date <= p.to);
}

const doneSessions = (h: History, date: IsoDate): WorkoutSession[] => h.sessions.filter((s) => s.date === date && s.status === "completed");

/** Calendar credit for a rest day: same rule as consistency (restDayCredited), only once the day has passed. */
function restCredited(h: History, date: IsoDate): boolean {
	return date <= h.today && restDayCredited(h, date);
}

/**
 * State of one calendar day. Days before the first plan entry have no plan, so they are never "missed".
 * A logged workout shows as done even when it was not a quality one; the day sheet explains whether it counted.
 */
export function calendarDayState(h: History, ctx: ProgressContext, date: IsoDate): CalendarDayState {
	const entry = h.plan.find((p) => p.date === date);
	const done = doneSessions(h, date).length > 0;
	if (done && date <= h.today) return "training-done";
	if (entry && inPause(ctx, date)) return "paused";
	if (!entry) return date === h.today ? "today" : "none";
	if (entry.type === "workout") {
		if (date < h.today) return "missed";
		return date === h.today ? "today" : "planned";
	}
	if (restCredited(h, date)) return "rest-credited";
	return date === h.today ? "today" : "rest";
}

export function calendarWeekSummary(h: History, ctx: ProgressContext, ws: IsoDate): CalendarWeekSummary {
	const current = weekStart(h.today);
	const future = ws > current;
	return {
		credited: !future && weekCredited(h, ctx, ws),
		paused: isPausedWeek(ctx, ws),
		current: ws === current,
		score: future ? null : weekScore(h, ws),
	};
}

/** Monday-first month grid: full weeks covering the month, 7 days + week summary each. */
export function calendarMonth(h: History, ctx: ProgressContext, month: string): CalendarMonth {
	const first = `${month}-01`;
	const last = lastDayOfMonth(month);
	const weeks: CalendarWeek[] = [];
	for (let ws = weekStart(first); ws <= last; ws = addDays(ws, 7)) {
		const days = eachDay(ws, addDays(ws, 6)).map(
			(date): CalendarDay => ({ date, inMonth: monthOf(date) === month, state: calendarDayState(h, ctx, date), isToday: date === h.today }),
		);
		weeks.push({ weekStart: ws, days, week: calendarWeekSummary(h, ctx, ws) });
	}
	return { month, weeks };
}

// ---- details for the sheets ----

export type RestReason = "nearest-done" | "nearest-not-done" | "nearest-upcoming" | "no-training" | "future";

export interface DaySessionDetail {
	id: string;
	minutes: number;
	quality: boolean;
	planned: boolean;
	completedSets: number;
	plannedSets: number;
	exercises: { id: string; name: string; sets: number }[];
}

export interface DayDetails {
	date: IsoDate;
	state: CalendarDayState;
	planned: "workout" | "rest" | null;
	sessions: DaySessionDetail[];
	rest: { credited: boolean; reason: RestReason; nearest: IsoDate | null } | null;
	paused: boolean;
	missed: boolean;
	future: boolean;
}

function sessionDetail(h: History, s: WorkoutSession): DaySessionDetail {
	const counts = new Map<string, number>();
	for (const set of s.sets) counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
	return {
		id: s.id,
		minutes: s.durationMin,
		quality: isQualitySession(s),
		planned: s.planned,
		completedSets: s.sets.length,
		plannedSets: s.setsPlanned,
		exercises: [...counts.entries()].map(([id, sets]) => ({ id, name: h.exercises.find((e) => e.id === id)?.name ?? id, sets })),
	};
}

export function dayDetails(h: History, ctx: ProgressContext, date: IsoDate): DayDetails {
	const entry = h.plan.find((p) => p.date === date);
	const state = calendarDayState(h, ctx, date);
	let rest: DayDetails["rest"] = null;
	if (entry?.type === "rest") {
		const nearest = nearestTrainingDay(h, date);
		const credited = state === "rest-credited";
		let reason: RestReason;
		if (date > h.today) reason = "future";
		else if (nearest === null) reason = "no-training";
		else if (credited) reason = "nearest-done";
		else if (nearest > h.today) reason = "nearest-upcoming";
		else reason = "nearest-not-done";
		rest = { credited, reason, nearest };
	}
	return {
		date,
		state,
		planned: entry?.type ?? null,
		sessions: date <= h.today ? doneSessions(h, date).map((s) => sessionDetail(h, s)) : [],
		rest,
		paused: entry !== undefined && inPause(ctx, date),
		missed: state === "missed",
		future: date > h.today,
	};
}

export interface WeekDetails {
	weekStart: IsoDate;
	summary: CalendarWeekSummary;
	goal: number;
	plannedDays: number;
	plannedWorkouts: number;
	qualityWorkouts: number;
	creditedRest: number;
	/** Weight of this week in the main consistency number, or null when it is not one of the 4 counted weeks. */
	weight: number | null;
	future: boolean;
}

/** How a week's C_week was computed: (quality workouts + credited rest days) / planned days. */
export function weekDetails(h: History, ctx: ProgressContext, ws: IsoDate): WeekDetails {
	let plannedDays = 0;
	let plannedWorkouts = 0;
	let qualityWorkouts = 0;
	let creditedRest = 0;
	for (const d of eachDay(ws, addDays(ws, 6))) {
		const entry = h.plan.find((p) => p.date === d);
		if (!entry) continue;
		plannedDays++;
		if (entry.type === "workout") {
			plannedWorkouts++;
			if (h.sessions.some((s) => s.date === d && isQualitySession(s))) qualityWorkouts++;
		} else if (restCredited(h, d)) creditedRest++;
	}
	const counted = consistencyV2(h, ctx).weeks.find((w) => w.weekStart === ws);
	return {
		weekStart: ws,
		summary: calendarWeekSummary(h, ctx, ws),
		goal: effectiveGoal(ctx),
		plannedDays,
		plannedWorkouts,
		qualityWorkouts,
		creditedRest,
		weight: counted?.weight ?? null,
		future: ws > weekStart(h.today),
	};
}
