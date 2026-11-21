import { addDays, weekStart } from "./dates";
import { isQualitySession } from "./days";
import { isPausedWeek, streakV2, weekCredited } from "./consistency";
import { personalRecords } from "./records";
import type { History, IsoDate, ProgressContext } from "./types";

export type BadgeId =
	| "first-workout"
	| "perfect-week"
	| "streak-2"
	| "streak-4"
	| "streak-6"
	| "streak-10"
	| "streak-20"
	| "first-pr"
	| "prs-5"
	| "workouts-20"
	| "workouts-50"
	| "workouts-100";

export interface Badge {
	id: BadgeId;
	unlocked: boolean;
	unlockedOn: IsoDate | null;
	current: number;
	target: number;
	remaining: number;
}

const make = (id: BadgeId, value: number, target: number, dates: IsoDate[]): Badge => {
	const current = Math.min(value, target);
	const unlocked = value >= target;
	return { id, unlocked, unlockedOn: unlocked ? (dates[target - 1] ?? null) : null, current, target, remaining: target - current };
};

const qualityOnDay = (h: History, d: IsoDate): boolean => h.sessions.some((s) => s.date === d && isQualitySession(s));
const plannedWorkoutDays = (h: History, ws: IsoDate): IsoDate[] =>
	h.plan.filter((p) => p.type === "workout" && p.date >= ws && p.date <= addDays(ws, 6)).map((p) => p.date);

function earliest(h: History): IsoDate | null {
	const all = [...h.plan.map((p) => p.date), ...h.sessions.map((s) => s.date)];
	return all.length === 0 ? null : all.reduce((a, b) => (b < a ? b : a));
}

function perfectWeek(h: History, ctx: ProgressContext): Badge {
	const e = earliest(h);
	const dates: IsoDate[] = [];
	if (e !== null) {
		for (let ws = weekStart(e); ws < weekStart(h.today); ws = addDays(ws, 7)) {
			const days = plannedWorkoutDays(h, ws);
			if (days.length > 0 && !isPausedWeek(ctx, ws) && days.every((d) => qualityOnDay(h, d))) dates.push(addDays(ws, 6));
		}
	}
	if (dates.length > 0) return make("perfect-week", 1, 1, dates);
	// Not earned yet: show progress of the current week (quality days / planned training days).
	const days = plannedWorkoutDays(h, weekStart(h.today));
	if (days.length === 0) return make("perfect-week", 0, 1, []);
	const done = days.filter((d) => qualityOnDay(h, d)).length;
	return { id: "perfect-week", unlocked: false, unlockedOn: null, current: done, target: days.length, remaining: days.length - done };
}

/** Date on which streakV2.best first reached n (the goal-th quality workout of that week), or null. */
function streakDates(h: History, ctx: ProgressContext, maxN: number): Map<number, IsoDate> {
	const out = new Map<number, IsoDate>();
	const e = earliest(h);
	if (e === null) return out;
	const goal = Math.min(5, Math.max(2, ctx.weeklyGoal));
	let reached = 0;
	for (let ws = weekStart(e); ws <= weekStart(h.today); ws = addDays(ws, 7)) {
		const best = streakV2({ ...h, today: addDays(ws, 6) }, ctx).best;
		if (best <= reached) continue;
		const qs = h.sessions
			.filter((s) => s.date >= ws && s.date <= addDays(ws, 6) && s.date <= h.today && isQualitySession(s))
			.map((s) => s.date)
			.sort();
		const date = qs[goal - 1] ?? h.today;
		for (let n = reached + 1; n <= Math.min(best, maxN); n++) out.set(n, date);
		reached = best;
	}
	return out;
}

export function badges(h: History, ctx: ProgressContext): Badge[] {
	const qDates = [...new Set(h.sessions.filter((s) => s.date <= h.today && isQualitySession(s)).map((s) => s.date))].sort();
	const prDates = personalRecords(h)
		.filter((r) => r.date <= h.today)
		.map((r) => r.date)
		.sort();
	const streak = streakV2(h, ctx).best;
	const sd = streakDates(h, ctx, 20);
	const streakBadge = (n: 2 | 4 | 6 | 10 | 20): Badge => {
		const b = make(`streak-${n}`, streak, n, []);
		return b.unlocked ? { ...b, unlockedOn: sd.get(n) ?? null } : b;
	};
	return [
		make("first-workout", qDates.length, 1, qDates),
		perfectWeek(h, ctx),
		streakBadge(2),
		streakBadge(4),
		streakBadge(6),
		streakBadge(10),
		streakBadge(20),
		make("first-pr", prDates.length, 1, prDates),
		make("prs-5", prDates.length, 5, prDates),
		make("workouts-20", qDates.length, 20, qDates),
		make("workouts-50", qDates.length, 50, qDates),
		make("workouts-100", qDates.length, 100, qDates),
	];
}

/** Not-yet-earned badges, closest first (current/target desc, then smaller remaining). */
export function nextBadges(list: Badge[], n: number): Badge[] {
	return list
		.map((b, i) => ({ b, i }))
		.filter((x) => !x.b.unlocked)
		.sort((x, y) => y.b.current / y.b.target - x.b.current / x.b.target || x.b.remaining - y.b.remaining || x.i - y.i)
		.slice(0, n)
		.map((x) => x.b);
}

/** Earned badges, newest first. */
export function recentBadges(list: Badge[], n: number): Badge[] {
	return list
		.map((b, i) => ({ b, i }))
		.filter((x) => x.b.unlocked)
		.sort((x, y) => (y.b.unlockedOn ?? "").localeCompare(x.b.unlockedOn ?? "") || x.i - y.i)
		.slice(0, n)
		.map((x) => x.b);
}

export function badgeProgressDelta(
	before: Badge[],
	after: Badge[],
): { id: BadgeId; from: number; to: number; target: number; unlocked: boolean }[] {
	const out: { id: BadgeId; from: number; to: number; target: number; unlocked: boolean }[] = [];
	for (const a of after) {
		const b = before.find((x) => x.id === a.id);
		const from = b?.current ?? 0;
		if (from !== a.current || (b?.unlocked ?? false) !== a.unlocked) out.push({ id: a.id, from, to: a.current, target: a.target, unlocked: a.unlocked });
	}
	return out;
}
