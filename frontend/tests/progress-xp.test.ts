import { describe, expect, it } from "vitest";
import { periodSummary } from "@/lib/progress/summary";
import type { History, IsoDate, ProgressContext, WorkoutSession } from "@/lib/progress/types";
import { levelFor, LEVEL_NAMES } from "@/lib/progress/levels";
import { xpForSession, xpLedger } from "@/lib/progress/xp";

function session(date: IsoDate, o: Partial<WorkoutSession> & { reps?: number } = {}): WorkoutSession {
	const { reps, ...rest } = o;
	return {
		id: `s-${date}`,
		date,
		planned: true,
		status: "completed",
		adapted: false,
		durationMin: 40,
		setsPlanned: 10,
		sets: Array.from({ length: 10 }, () => ({ exerciseId: "pushup", reps: reps ?? 8, weightKg: null, durationSec: null })),
		rpe: null,
		...rest,
	};
}

// Mon 16 workout, Tue 17 rest, Wed 18 workout, Thu 19 rest (today), Sun 15 rest.
const base: History = {
	today: "2026-11-19",
	exercises: [{ id: "pushup", name: "Push-up", kind: "bodyweight" }],
	plan: [
		{ date: "2026-11-15", type: "rest" },
		{ date: "2026-11-16", type: "workout" },
		{ date: "2026-11-17", type: "rest" },
		{ date: "2026-11-18", type: "workout" },
		{ date: "2026-11-19", type: "rest" },
		{ date: "2026-11-20", type: "rest" },
	],
	sessions: [session("2026-11-16"), session("2026-11-18", { reps: 10 })],
	body: [],
	checkIns: [], device: null,
};
const empty: History = { ...base, plan: [], sessions: [] };

const ctx: ProgressContext = { weeklyGoal: 2, pauses: [] };
const sum = (l: { amount: number }[]): number => l.reduce((a, e) => a + e.amount, 0);
const withSets = (date: IsoDate, n: number, o: Partial<WorkoutSession> = {}): WorkoutSession => ({
	...session(date),
	sets: Array.from({ length: n }, () => ({ exerciseId: "pushup", reps: 8, weightKg: null, durationSec: null })),
	...o,
});

describe("xpLedger", () => {
	it("ratio 0.8 -> 80, ratio 0.6 -> 0", () => {
		const h = (n: number): History => ({ ...empty, sessions: [withSets("2026-11-16", n)] });
		expect(xpLedger(h(8), ctx)).toEqual([{ date: "2026-11-16", source: "workout", amount: 80 }]);
		expect(xpLedger(h(6), ctx)).toEqual([]);
	});
	it("one rewarded workout per day, tie -> earliest id", () => {
		const h: History = { ...empty, sessions: [withSets("2026-11-16", 8, { id: "b" }), withSets("2026-11-16", 10, { id: "a" }), withSets("2026-11-16", 10, { id: "c" })] };
		expect(xpLedger(h, ctx)).toEqual([{ date: "2026-11-16", source: "workout", amount: 100 }]);
		expect(xpForSession(h, ctx, "a").workout).toBe(100);
		expect(xpForSession(h, ctx, "c").workout).toBe(0);
	});
	it("PR XP is capped at 3 per workout", () => {
		const h: History = {
			...empty,
			exercises: [1, 2, 3, 4].map((i) => ({ id: `e${i}`, name: `E${i}`, kind: "bodyweight" as const })),
			sessions: [
				{ ...withSets("2026-11-09", 10), sets: [1, 2, 3, 4].map((i) => ({ exerciseId: `e${i}`, reps: 5, weightKg: null, durationSec: null })), id: "p" },
				{ ...withSets("2026-11-16", 10), sets: [1, 2, 3, 4].map((i) => ({ exerciseId: `e${i}`, reps: 9, weightKg: null, durationSec: null })), id: "q" },
			],
		};
		expect(xpLedger(h, ctx).filter((e) => e.source === "pr")).toEqual([{ date: "2026-11-16", source: "pr", amount: 75 }]);
	});
	it("credited finished week +50 on its Sunday; paused week and current week give none", () => {
		const h: History = { ...empty, today: "2026-11-19", sessions: [withSets("2026-11-09", 10), withSets("2026-11-10", 10), withSets("2026-11-16", 10), withSets("2026-11-17", 10)] };
		const weeks = xpLedger(h, ctx).filter((e) => e.source === "week");
		expect(weeks).toEqual([{ date: "2026-11-15", source: "week", amount: 50 }]);
		const paused = { ...ctx, pauses: [{ from: "2026-11-09", to: "2026-11-15" }] };
		expect(xpLedger(h, paused).filter((e) => e.source === "week")).toEqual([]);
	});
	it("credited rest day +5, uncredited 0", () => {
		expect(xpLedger(base, ctx).filter((e) => e.source === "rest").map((e) => e.date)).toEqual(["2026-11-17", "2026-11-19"]);
		const none: History = { ...base, sessions: [] };
		expect(sum(xpLedger(none, ctx))).toBe(0);
	});
	it("empty history", () => {
		expect(xpLedger(empty, ctx)).toEqual([]);
	});
	it("xpForSession: ratio 0.8 and one record", () => {
		const h: History = { ...empty, sessions: [withSets("2026-11-09", 10, { id: "p", sets: [{ exerciseId: "pushup", reps: 5, weightKg: null, durationSec: null }] , setsPlanned: 1}), withSets("2026-11-16", 8, { id: "q", sets: Array.from({ length: 8 }, (_, i) => ({ exerciseId: "pushup", reps: i === 0 ? 9 : 4, weightKg: null, durationSec: null })) })] };
		expect(xpForSession(h, ctx, "q")).toEqual({ workout: 80, prs: 25, week: 0, rest: 0, total: 105 });
		expect(xpForSession(h, ctx, "nope").total).toBe(0);
	});
});

describe("levelFor", () => {
	it("thresholds", () => {
		expect(levelFor(0).level).toBe(1);
		expect(levelFor(499).level).toBe(1);
		expect(levelFor(500).level).toBe(2);
		expect(levelFor(1250).level).toBe(3);
		expect([2250, 3500, 5000, 6750, 8750].map((x) => levelFor(x).level)).toEqual([4, 5, 6, 7, 8]);
	});
	it("into/span/pct and 7->8 costs 2000", () => {
		expect(levelFor(0)).toEqual({ level: 1, name: LEVEL_NAMES[0], xp: 0, into: 0, span: 500, pct: 0 });
		const l = levelFor(750);
		expect([l.level, l.into, l.span, l.pct]).toEqual([2, 250, 750, 33]);
		expect(levelFor(6750).span).toBe(2000);
	});
	it("names cap at the last", () => {
		expect(LEVEL_NAMES).toHaveLength(10);
		expect(levelFor(10_000_000).name).toBe("fit.progress.levels.10");
	});
});

describe("periodSummary", () => {
	it("порожнього періоду", () => {
		expect(periodSummary(empty, "2026-11-16", "2026-11-22")).toEqual({ workouts: 0, missed: 0, minutes: 0, sets: 0, adherencePct: null });
	});
	it("to обрізається до today; adherence", () => {
		// clamped to today: 16w,17r,18w,19r = 4 entries, all good
		expect(periodSummary(base, "2026-11-16", "2026-11-22")).toEqual({ workouts: 2, missed: 0, minutes: 80, sets: 20, adherencePct: 100 });
	});
	it("пропущений день", () => {
		const m: History = { ...base, sessions: [session("2026-11-18")] };
		expect(periodSummary(m, "2026-11-16", "2026-11-19").missed).toBe(1);
	});
});
