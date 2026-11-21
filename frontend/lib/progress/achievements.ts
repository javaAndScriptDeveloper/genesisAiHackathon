import { addDays, eachDay, weekStart } from "./dates";
import { isRestKept, streakWeeks, weeklyGoal } from "./consistency";
import { isQualitySession } from "./days";
import { personalRecords } from "./records";
import type { History, IsoDate } from "./types";

export type AchievementId =
	| "first_workout"
	| "workouts_5"
	| "workouts_10"
	| "workouts_25"
	| "workouts_50"
	| "first_plan_week"
	| "streak_2"
	| "streak_4"
	| "streak_8"
	| "first_pr"
	| "prs_5"
	| "hours_10"
	| "rest_4_weeks";

export interface Achievement {
	id: AchievementId;
	current: number;
	target: number;
	unlocked: boolean;
}

const isDone = (s: string): boolean => s === "completed" || s === "adapted";

function earliestPlan(h: History): IsoDate | null {
	return h.plan.reduce<IsoDate | null>((m, p) => (m === null || p.date < m ? p.date : m), null);
}

/** Full weeks before the current one, newest first, starting no earlier than the first plan entry. */
function fullWeekStarts(h: History): IsoDate[] {
	const earliest = earliestPlan(h);
	if (earliest === null) return [];
	const out: IsoDate[] = [];
	for (let ws = addDays(weekStart(h.today), -7); ws >= weekStart(earliest); ws = addDays(ws, -7)) out.push(ws);
	return out;
}

function hasPlanFullyDone(h: History): boolean {
	return fullWeekStarts(h).some((ws) => {
		const w = weeklyGoal(h, ws).days.filter((d) => d.type === "workout" && d.status !== "none");
		return w.length > 0 && w.every((d) => isDone(d.status));
	});
}

function restWeeks(h: History): number {
	let n = 0;
	for (const ws of fullWeekStarts(h)) {
		const rests = eachDay(ws, addDays(ws, 6)).filter((d) => h.plan.some((p) => p.date === d && p.type === "rest"));
		if (rests.length === 0 || !rests.every((d) => isRestKept(h, d))) break;
		n++;
	}
	return n;
}

export function achievements(h: History): Achievement[] {
	const quality = h.sessions.filter(isQualitySession).length;
	const prs = personalRecords(h).length;
	const minutes = h.sessions.filter((s) => s.status === "completed").reduce((a, s) => a + s.durationMin, 0);
	const streak = streakWeeks(h);
	const make = (id: AchievementId, value: number, target: number): Achievement => {
		const current = Math.min(value, target);
		return { id, current, target, unlocked: current >= target };
	};
	return [
		make("first_workout", quality, 1),
		make("workouts_5", quality, 5),
		make("workouts_10", quality, 10),
		make("workouts_25", quality, 25),
		make("workouts_50", quality, 50),
		make("first_plan_week", hasPlanFullyDone(h) ? 1 : 0, 1),
		make("streak_2", streak, 2),
		make("streak_4", streak, 4),
		make("streak_8", streak, 8),
		make("first_pr", prs, 1),
		make("prs_5", prs, 5),
		make("hours_10", minutes, 600),
		make("rest_4_weeks", restWeeks(h), 4),
	];
}

export function nearestAchievements(list: Achievement[], n: number): Achievement[] {
	return list
		.filter((a) => !a.unlocked)
		.map((a, i) => ({ a, i }))
		.sort((x, y) => y.a.current / y.a.target - x.a.current / x.a.target || x.i - y.i)
		.slice(0, n)
		.map((x) => x.a);
}
