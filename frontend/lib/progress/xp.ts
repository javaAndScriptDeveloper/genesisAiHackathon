import { addDays, weekStart } from "./dates";
import { isQualitySession } from "./days";
import { isPausedWeek, restDayCredited, weekCredited } from "./consistency";
import { personalRecords } from "./records";
import type { History, IsoDate, ProgressContext, WorkoutSession } from "./types";

export interface XpEntry {
	date: IsoDate;
	source: "workout" | "pr" | "week" | "rest";
	amount: number;
}
export interface XpBreakdown {
	workout: number;
	prs: number;
	week: number;
	rest: number;
	total: number;
}

const PR_XP = 25;
const PR_CAP = 3;
const WEEK_XP = 50;
const REST_XP = 5;

const ratio = (s: WorkoutSession): number => s.sets.length / s.setsPlanned;
const workoutXp = (s: WorkoutSession): number => (isQualitySession(s) ? Math.round(100 * ratio(s)) : 0);

function prCounts(h: History): Map<string, number> {
	const m = new Map<string, number>();
	for (const r of personalRecords(h)) m.set(r.sessionId, (m.get(r.sessionId) ?? 0) + 1);
	return m;
}

/** At most one rewarded workout per calendar day: most XP, tie → earliest id. */
function rewardedSessions(h: History): WorkoutSession[] {
	const byDay = new Map<IsoDate, WorkoutSession>();
	for (const s of h.sessions) {
		if (s.date > h.today || workoutXp(s) <= 0) continue;
		const cur = byDay.get(s.date);
		if (!cur || workoutXp(s) > workoutXp(cur) || (workoutXp(s) === workoutXp(cur) && s.id < cur.id)) byDay.set(s.date, s);
	}
	return [...byDay.values()];
}

export function xpLedger(h: History, ctx: ProgressContext): XpEntry[] {
	const out: XpEntry[] = [];
	const prs = prCounts(h);
	for (const s of rewardedSessions(h)) {
		out.push({ date: s.date, source: "workout", amount: workoutXp(s) });
	}
	for (const s of h.sessions) {
		const n = Math.min(PR_CAP, prs.get(s.id) ?? 0);
		if (n > 0 && s.date <= h.today) out.push({ date: s.date, source: "pr", amount: n * PR_XP });
	}
	const dates = [...h.plan.map((p) => p.date), ...h.sessions.map((s) => s.date)];
	if (dates.length > 0) {
		const earliest = dates.reduce((a, b) => (b < a ? b : a));
		for (let ws = weekStart(earliest); ws < weekStart(h.today); ws = addDays(ws, 7)) {
			if (!isPausedWeek(ctx, ws) && weekCredited(h, ctx, ws)) out.push({ date: addDays(ws, 6), source: "week", amount: WEEK_XP });
		}
	}
	for (const p of h.plan) {
		if (p.type === "rest" && p.date <= h.today && restDayCredited(h, p.date)) out.push({ date: p.date, source: "rest", amount: REST_XP });
	}
	return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** XP earned by one session (workout + records). Week and rest bonuses are not attributable to a session. */
export function xpForSession(h: History, ctx: ProgressContext, sessionId: string): XpBreakdown {
	void ctx;
	const s = h.sessions.find((x) => x.id === sessionId);
	if (!s) return { workout: 0, prs: 0, week: 0, rest: 0, total: 0 };
	const rewarded = rewardedSessions(h).some((r) => r.id === s.id);
	const workout = rewarded ? workoutXp(s) : 0;
	const prs = Math.min(PR_CAP, prCounts(h).get(s.id) ?? 0) * PR_XP;
	return { workout, prs, week: 0, rest: 0, total: workout + prs };
}
