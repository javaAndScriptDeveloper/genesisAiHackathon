import { describe, expect, it } from "vitest";
import {
	ENGINE_VERSION,
	PREMIUM,
	celebrationGroup,
	detectEvents,
	progressSnapshot,
	reportReadyEvent,
	snapshotHash,
	unseen,
	visibleHistoryFrom,
} from "@/lib/progress";
import type { Badge, BadgeId, History, ProgressContext, ProgressEvent, ProgressSnapshot } from "@/lib/progress";

const today = "2026-11-21"; // Saturday
const empty: History = { today, exercises: [], plan: [], sessions: [], body: [], checkIns: [], device: null };
const ctx: ProgressContext = { weeklyGoal: 3, pauses: [] };
const NOW = "2026-11-21T10:00:00Z";

const hasNaN = (v: unknown): boolean => {
	if (typeof v === "number") return !Number.isFinite(v);
	if (Array.isArray(v)) return v.some(hasNaN);
	if (v && typeof v === "object") return Object.values(v).some(hasNaN);
	return false;
};

const unlockedBadge = (id: BadgeId): Badge => ({ id, unlocked: true, unlockedOn: today, current: 1, target: 1, remaining: 0 });
const withBadges = (s: ProgressSnapshot, ids: BadgeId[], level: number): ProgressSnapshot => ({
	...s,
	level: { ...s.level, level },
	badges: ids.map(unlockedBadge),
});

describe("snapshot", () => {
	const before = progressSnapshot(empty, ctx);
	it("empty history has no NaN", () => {
		expect(hasNaN(before)).toBe(false);
		expect(before.week.goal).toBe(3);
		expect(before.advice).toEqual({ id: "start", vars: {} });
	});
	it("clamps weekly goal", () => {
		expect(progressSnapshot(empty, { weeklyGoal: 9, pauses: [] }).week.goal).toBe(5);
		expect(progressSnapshot(empty, { weeklyGoal: 0, pauses: [] }).week.goal).toBe(2);
	});
	it("non-finite weekly goal falls back to 3", () => {
		expect(progressSnapshot(empty, { weeklyGoal: NaN, pauses: [] }).week.goal).toBe(3);
		expect(progressSnapshot(empty, { weeklyGoal: Infinity, pauses: [] }).week.goal).toBe(3);
	});
	it("ENGINE_VERSION", () => expect(ENGINE_VERSION).toBe("2.0.0"));
});

describe("events", () => {
	const before = progressSnapshot(empty, ctx);
	const after = withBadges(before, ["first-workout", "perfect-week"], before.level.level + 1);
	it("2 badges + level -> 3 events and one celebration", () => {
		const ev = detectEvents(before, after, NOW);
		expect(ev.map((e) => e.id).sort()).toEqual(
			["badge:first-workout", "badge:perfect-week", `level:${before.level.level + 1}`].sort(),
		);
		expect(ev.every((e) => e.createdAt === NOW && e.seenAt === null)).toBe(true);
		expect(celebrationGroup(ev)).toEqual({ badges: ["first-workout", "perfect-week"], level: before.level.level + 1 });
	});
	it("same events twice give same ids", () => {
		const a = detectEvents(before, after, NOW).map((e) => e.id);
		const b = detectEvents(before, after, "2026-11-22T00:00:00Z").map((e) => e.id);
		expect(a).toEqual(b);
	});
	it("no change -> no events; pr events", () => {
		expect(detectEvents(before, before, NOW)).toEqual([]);
		const rec = { exerciseId: "bench", metric: "e1rm" as const, value: 90, previous: 80, date: today, sessionId: "s" };
		const ev = detectEvents(before, { ...before, records: [rec] }, NOW);
		expect(ev[0]).toMatchObject({ id: `pr:bench:e1rm:${today}`, kind: "pr" });
	});
	it("unseen after seenAt", () => {
		const ev = detectEvents(before, after, NOW);
		expect(unseen(ev)).toEqual({ any: true, byKind: { badge: 2, level: 1, pr: 0, report: 0 } });
		const seen: ProgressEvent[] = ev.map((e) => ({ ...e, seenAt: NOW }));
		expect(unseen(seen).any).toBe(false);
		expect(celebrationGroup(seen)).toBeNull();
		expect(celebrationGroup([])).toBeNull();
	});
	it("report ready only for a planned previous week", () => {
		expect(reportReadyEvent(empty, ctx, NOW)).toBeNull();
		const h: History = { ...empty, plan: [{ date: "2026-11-11", type: "workout" }] };
		expect(reportReadyEvent(h, ctx, NOW)).toMatchObject({ id: "report:2026-11-09", kind: "report", refId: "2026-11-09", seenAt: null });
	});
});

describe("hash and premium", () => {
	const s = progressSnapshot(empty, ctx);
	it("stable across key order, sensitive to numbers", () => {
		const reorder = (v: unknown): unknown =>
			Array.isArray(v)
				? v.map(reorder)
				: v && typeof v === "object"
					? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorder(x)]))
					: v;
		const reordered: ProgressSnapshot = { ...s, ...Object.fromEntries(Object.entries(s).reverse().map(([k, x]) => [k, reorder(x)])) };
		expect(Object.keys(reordered.streak)).toEqual(Object.keys(s.streak).reverse());
		expect(snapshotHash(reordered)).toBe(snapshotHash(s));
		expect(snapshotHash(s)).toMatch(/^[0-9a-f]{8}$/);
		expect(snapshotHash({ ...s, streak: { current: 1, best: 0 } })).not.toBe(snapshotHash(s));
	});
	it("premium", () => {
		expect(PREMIUM.historyMonths).toBe(3);
		expect(visibleHistoryFrom(today, true)).toBeNull();
		expect(visibleHistoryFrom(today, false)).toBe("2026-08-22");
	});
});
