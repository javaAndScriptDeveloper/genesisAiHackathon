import { addDays, weekStart } from "./dates";
import type { ProgressSnapshot } from "./engine";
import type { History, ProgressContext, ProgressEvent } from "./types";

const ev = (kind: ProgressEvent["kind"], refId: string, now: string): ProgressEvent => ({
	id: `${kind}:${refId}`,
	kind,
	refId,
	createdAt: now,
	seenAt: null,
});

export function detectEvents(before: ProgressSnapshot, after: ProgressSnapshot, now: string): ProgressEvent[] {
	const out: ProgressEvent[] = [];
	const had = new Set(before.badges.filter((b) => b.unlocked).map((b) => b.id));
	for (const b of after.badges) if (b.unlocked && !had.has(b.id)) out.push(ev("badge", b.id, now));
	if (after.level.level > before.level.level) out.push(ev("level", String(after.level.level), now));
	const key = (r: ProgressSnapshot["records"][number]) => `${r.exerciseId}:${r.metric}:${r.date}`;
	const known = new Set(before.records.map(key));
	for (const r of after.records) if (!known.has(key(r))) out.push(ev("pr", key(r), now));
	return out;
}

/** From Monday on: the previous finished week's report, if that week had a plan. */
export function reportReadyEvent(h: History, _ctx: ProgressContext, now: string): ProgressEvent | null {
	const prev = addDays(weekStart(h.today), -7);
	const end = addDays(prev, 6);
	return h.plan.some((p) => p.date >= prev && p.date <= end) ? ev("report", prev, now) : null;
}

export function unseen(events: ProgressEvent[]): { any: boolean; byKind: Record<ProgressEvent["kind"], number> } {
	const byKind: Record<ProgressEvent["kind"], number> = { badge: 0, level: 0, pr: 0, report: 0 };
	for (const e of events) if (e.seenAt === null) byKind[e.kind]++;
	return { any: Object.values(byKind).some((n) => n > 0), byKind };
}

export function celebrationGroup(events: ProgressEvent[]): { badges: string[]; level: number | null } | null {
	const open = events.filter((e) => e.seenAt === null);
	const badges = open.filter((e) => e.kind === "badge").map((e) => e.refId);
	const levels = open.filter((e) => e.kind === "level").map((e) => Number(e.refId));
	const level = levels.length > 0 ? Math.max(...levels) : null;
	return badges.length === 0 && level === null ? null : { badges, level };
}
