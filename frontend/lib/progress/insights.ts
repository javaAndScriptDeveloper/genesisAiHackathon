import { addDays, daysBetween, weekday } from "./dates";
import { consistencyScore } from "./consistency";
import { dayStatus } from "./days";
import { exerciseSeries } from "./records";
import type { History } from "./types";

export type InsightId = "too_hard" | "weekday_misses" | "strength_gain" | "consistency_up";
export interface Insight {
	id: InsightId;
	vars: Record<string, string | number>;
}

function tooHard(h: History): Insight | null {
	const rated = h.sessions
		.filter((s) => s.rpe !== null && s.date <= h.today)
		.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
	if (rated.length < 3) return null;
	return rated.slice(-3).every((s) => s.rpe === "hard") ? { id: "too_hard", vars: {} } : null;
}

function weekdayMisses(h: History): Insight | null {
	const counts = new Array<number>(7).fill(0);
	for (const p of h.plan) {
		const ago = daysBetween(p.date, h.today);
		if (ago < 1 || ago > 56 || dayStatus(h, p.date) !== "missed") continue;
		const w = weekday(p.date);
		counts[w] = (counts[w] ?? 0) + 1;
	}
	let best = -1;
	let bestCount = 1;
	counts.forEach((c, w) => {
		if (c > bestCount) {
			best = w;
			bestCount = c;
		}
	});
	return best < 0 ? null : { id: "weekday_misses", vars: { weekday: best } };
}

function gainFor(h: History, exerciseId: string): { insight: Insight; growth: number } | null {
	const ex = h.exercises.find((e) => e.id === exerciseId);
	if (!ex) return null;
	const from = addDays(h.today, -28);
	const pts = exerciseSeries(h, exerciseId).filter((p) => p.date >= from && p.date <= h.today);
	const first = pts[0];
	const last = pts[pts.length - 1];
	if (!first || !last || pts.length < 2 || first.value <= 0) return null;
	const growth = (last.value - first.value) / first.value;
	if (growth <= 0) return null;
	const weeks = Math.max(1, Math.round(daysBetween(first.date, last.date) / 7));
	return {
		growth,
		insight: { id: "strength_gain", vars: { exerciseId, exercise: ex.name, from: first.value, to: last.value, weeks } },
	};
}

function strengthGain(h: History): Insight | null {
	let best: { insight: Insight; growth: number } | null = null;
	for (const e of h.exercises) {
		const g = gainFor(h, e.id);
		if (g && (!best || g.growth > best.growth)) best = g;
	}
	return best?.insight ?? null;
}

export function exerciseInsight(h: History, exerciseId: string): Insight | null {
	return gainFor(h, exerciseId)?.insight ?? null;
}

function consistencyUp(h: History): Insight | null {
	const { delta } = consistencyScore(h);
	return delta !== null && delta > 0 ? { id: "consistency_up", vars: { delta } } : null;
}

export function insights(h: History, limit = 2): Insight[] {
	const rules = [tooHard, weekdayMisses, strengthGain, consistencyUp];
	const out: Insight[] = [];
	for (const rule of rules) {
		if (out.length >= limit) break;
		const i = rule(h);
		if (i) out.push(i);
	}
	return out;
}
