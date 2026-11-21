import type { DayStatus, History, IsoDate, WorkoutSession } from "./types";

/** History as it was at the end of `end`: nothing later can leak in. */
export function truncateHistory(h: History, end: IsoDate): History {
	return {
		...h,
		today: end,
		sessions: h.sessions.filter((s) => s.date <= end),
		plan: h.plan.filter((p) => p.date <= end),
		body: h.body.filter((b) => b.date <= end),
		checkIns: h.checkIns.filter((c) => c.date <= end),
	};
}

export function isQualitySession(s: WorkoutSession): boolean {
	return s.planned && s.status === "completed" && s.setsPlanned > 0 && s.sets.length / s.setsPlanned >= 0.7;
}

export function dayStatus(h: History, date: IsoDate): DayStatus {
	const planned = h.plan.find((p) => p.date === date);
	if (!planned) return "none";
	if (planned.type === "rest") return "rest";
	const quality = h.sessions.find((s) => s.date === date && isQualitySession(s));
	if (quality) return quality.adapted ? "adapted" : "completed";
	return date < h.today ? "missed" : "planned";
}
