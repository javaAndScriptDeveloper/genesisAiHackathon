import { consistencyV2, isPausedWeek, streakV2 } from "./consistency";
import { addDays, daysBetween, weekStart } from "./dates";
import { isQualitySession } from "./days";
import { estimate1RM, exerciseSeries, mainMetric, type RecordMetric } from "./records";
import type { Exercise, History, ProgressContext } from "./types";

export type Improvement =
	| { kind: "record"; exerciseId: string; metric: RecordMetric; now: number; before: number; delta: number }
	| { kind: "consistency"; now: number; before: number; delta: number }
	| { kind: "streak"; now: number; before: number; delta: number };

export type AdviceId = "start" | "plateau" | "goal-remaining" | "near-record";
export interface Advice {
	id: AdviceId;
	vars: Record<string, string | number>;
}

const LOOKBACK = 28;
const RECENT = 14;
const MAX_IMPROVEMENTS = 2;

function metricOf(h: History, ex: Exercise): RecordMetric {
	if (ex.kind !== "weighted") return mainMetric(ex.kind);
	const anyE1rm = h.sessions.some(
		(s) => s.status === "completed" && s.sets.some((x) => x.exerciseId === ex.id && x.weightKg !== null && estimate1RM(x.weightKg, x.reps) !== null),
	);
	return anyE1rm ? "e1rm" : "weight";
}

const relative = (i: Improvement): number => i.delta / Math.max(i.before, 1);

/** What improved versus 28 days ago: at most 2, positive deltas only, biggest relative gain first. */
export function improvements(h: History, ctx: ProgressContext): Improvement[] {
	const cutoff = addDays(h.today, -LOOKBACK);
	const out: Improvement[] = [];
	for (const ex of h.exercises) {
		const series = exerciseSeries(h, ex.id).filter((p) => p.date <= h.today);
		const now = series[series.length - 1];
		const before = [...series].reverse().find((p) => p.date <= cutoff);
		if (now && before && now.value > before.value) {
			out.push({ kind: "record", exerciseId: ex.id, metric: metricOf(h, ex), now: now.value, before: before.value, delta: Math.round((now.value - before.value) * 10) / 10 });
		}
	}
	const past: History = { ...h, today: cutoff };
	const cNow = consistencyV2(h, ctx).score;
	const cBefore = consistencyV2(past, ctx).score;
	if (cNow !== null && cBefore !== null && cNow > cBefore) out.push({ kind: "consistency", now: cNow, before: cBefore, delta: cNow - cBefore });
	const sNow = streakV2(h, ctx).current;
	const sBefore = streakV2(past, ctx).current;
	if (sNow > sBefore) out.push({ kind: "streak", now: sNow, before: sBefore, delta: sNow - sBefore });
	return out.sort((a, b) => relative(b) - relative(a)).slice(0, MAX_IMPROVEMENTS);
}

/** Exactly one next step, or null when nothing applies. Priority: goal-remaining, near-record, plateau. */
export function advice(h: History, ctx: ProgressContext): Advice | null {
	const done = h.sessions.filter((s) => s.status === "completed");
	if (done.length === 0) return { id: "start", vars: {} };

	const ws = weekStart(h.today);
	if (!isPausedWeek(ctx, ws)) {
		const goal = Math.min(5, Math.max(2, ctx.weeklyGoal));
		const end = addDays(ws, 6);
		const quality = h.sessions.filter((s) => s.date >= ws && s.date <= end && isQualitySession(s)).length;
		const remaining = goal - quality;
		const daysLeft = daysBetween(h.today, end) + 1;
		if (remaining > 0 && daysLeft >= remaining) return { id: "goal-remaining", vars: { n: remaining } };
	}

	const windowStart = addDays(h.today, -(RECENT - 1));
	let plateau: Advice | null = null;
	for (const ex of h.exercises) {
		const series = exerciseSeries(h, ex.id).filter((p) => p.date <= h.today);
		if (series.length === 0) continue;
		const recent = series.filter((p) => p.date >= windowStart);
		const earlier = series.filter((p) => p.date < windowStart);
		if (recent.length === 0) continue;
		const record = Math.max(...series.map((p) => p.value));
		const recentBest = Math.max(...recent.map((p) => p.value));
		if (recentBest < record && recentBest >= record * 0.95) {
			return { id: "near-record", vars: { exerciseId: ex.id, exercise: ex.name, target: record } };
		}
		if (!plateau && recent.length >= 4 && earlier.length > 0 && recentBest <= Math.max(...earlier.map((p) => p.value))) {
			plateau = { id: "plateau", vars: { exerciseId: ex.id, exercise: ex.name } };
		}
	}
	return plateau;
}
