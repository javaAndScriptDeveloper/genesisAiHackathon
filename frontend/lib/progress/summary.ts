import { eachDay } from "./dates";
import { isRestKept } from "./consistency";
import { dayStatus, isQualitySession } from "./days";
import type { History, IsoDate } from "./types";

export interface PeriodSummary {
	workouts: number;
	missed: number;
	minutes: number;
	sets: number;
	adherencePct: number | null;
}

export function periodSummary(h: History, from: IsoDate, to: IsoDate): PeriodSummary {
	const end = to > h.today ? h.today : to;
	const days = eachDay(from, end);
	let missed = 0;
	for (const d of days) if (dayStatus(h, d) === "missed") missed++;

	const inRange = h.sessions.filter((s) => s.date >= from && s.date <= end);
	const workouts = inRange.filter(isQualitySession).length;
	const completed = inRange.filter((s) => s.status === "completed");
	const minutes = completed.reduce((a, s) => a + s.durationMin, 0);
	const sets = completed.reduce((a, s) => a + s.sets.length, 0);

	let entries = 0;
	let good = 0;
	for (const p of h.plan) {
		if (p.date < from || p.date > end) continue;
		entries++;
		const st = dayStatus(h, p.date);
		if (p.type === "workout" ? st === "completed" || st === "adapted" : isRestKept(h, p.date)) good++;
	}
	return { workouts, missed, minutes, sets, adherencePct: entries === 0 ? null : Math.round((100 * good) / entries) };
}
