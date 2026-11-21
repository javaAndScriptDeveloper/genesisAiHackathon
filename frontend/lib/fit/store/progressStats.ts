import { progressSnapshot, type ProgressSnapshot } from "../../progress/engine";
import { unseen } from "../../progress/events";
import { historyFromFit } from "../../progress/fromFit";
import type { History, ProgressContext } from "../../progress/types";
import { xpLedger } from "../../progress/xp";
import type { ISODate } from "../dates";
import type { FitState } from "../types";

/** The one progress context of the app: the user's weekly goal (2–5) and pauses. Never derive it elsewhere. */
export function progressCtx(state: Pick<FitState, "weeklyGoal" | "pauses" | "profile">): ProgressContext {
	const goal = Number.isFinite(state.weeklyGoal) ? state.weeklyGoal : (state.profile?.daysPerWeek ?? 3);
	return { weeklyGoal: Math.min(5, Math.max(2, Math.round(goal))), pauses: state.pauses ?? [] };
}

export type ProgressView = ProgressSnapshot & { history: History; ctx: ProgressContext; xp: number; unseen: ReturnType<typeof unseen> };

// Every screen reads the same state object; compute its snapshot once per (state, today) instead of once per hook.
const cache = new WeakMap<FitState, Map<ISODate, ProgressView>>();

/** Everything lib/progress knows about this state. Pure and memoized on the state object identity. */
export function progressOf(state: FitState, today: ISODate): ProgressView {
	let byDay = cache.get(state);
	const hit = byDay?.get(today);
	if (hit) return hit;
	const history = historyFromFit(state, today);
	const ctx = progressCtx(state);
	const view: ProgressView = {
		...progressSnapshot(history, ctx),
		history,
		ctx,
		xp: xpLedger(history, ctx).reduce((n, e) => n + e.amount, 0),
		unseen: unseen(state.progressEvents ?? []),
	};
	if (!byDay) {
		byDay = new Map();
		cache.set(state, byDay);
	}
	byDay.set(today, view);
	return view;
}

/** The progress fields of `useFitStats()`, read from the engine. Streak is in weeks (credited weeks in a row). */
export function fitStatsFromSnapshot(p: Pick<ProgressView, "streak" | "consistency" | "level" | "xp">) {
	return {
		streak: { current: p.streak.current, longest: p.streak.best },
		consistency: p.consistency.score ?? 0,
		level: p.level,
		xp: p.xp,
	};
}
