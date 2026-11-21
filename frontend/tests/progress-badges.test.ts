import { describe, expect, it } from "vitest";
import { badgeProgressDelta, badges, nextBadges, recentBadges } from "@/lib/progress/badges";
import type { History, IsoDate, ProgressContext, WorkoutSession } from "@/lib/progress/types";

const ctx: ProgressContext = { weeklyGoal: 2, pauses: [] };
const q = (date: IsoDate, id = `s-${date}`, reps = 8): WorkoutSession => ({
	id,
	date,
	planned: true,
	status: "completed",
	adapted: false,
	durationMin: 40,
	setsPlanned: 10,
	sets: Array.from({ length: 10 }, () => ({ exerciseId: "pushup", reps, weightKg: null, durationSec: null })),
	rpe: null,
});
const mk = (today: IsoDate, plan: string[], sessions: WorkoutSession[]): History => ({
	today,
	exercises: [{ id: "pushup", name: "Push-up", kind: "bodyweight" }],
	plan: plan.map((date) => ({ date, type: "workout" as const })),
	sessions,
	body: [],
	checkIns: [], device: null,
});
const get = (l: ReturnType<typeof badges>, id: string) => l.find((b) => b.id === id)!;

describe("badges", () => {
	it("S0: nothing unlocked, first-workout is the next badge with remaining 1", () => {
		const l = badges(mk("2026-11-19", [], []), ctx);
		expect(l).toHaveLength(12);
		expect(l.some((b) => b.unlocked)).toBe(false);
		expect(nextBadges(l, 3)[0]).toMatchObject({ id: "first-workout", remaining: 1 });
	});
	it("first-workout, workouts and PR badges with unlockedOn", () => {
		const h = mk("2026-11-19", [], [q("2026-11-16", "a", 5), q("2026-11-18", "b", 9)]);
		const l = badges(h, ctx);
		expect(get(l, "first-workout")).toMatchObject({ unlocked: true, unlockedOn: "2026-11-16", current: 1 });
		expect(get(l, "first-pr")).toMatchObject({ unlocked: true, unlockedOn: "2026-11-18" });
		expect(get(l, "prs-5")).toMatchObject({ unlocked: false, current: 1, remaining: 4 });
		expect(get(l, "workouts-20")).toMatchObject({ current: 2, remaining: 18 });
	});
	it("perfect-week: finished week, all planned workouts quality", () => {
		const h = mk("2026-11-19", ["2026-11-09", "2026-11-11"], [q("2026-11-09"), q("2026-11-11")]);
		expect(get(badges(h, ctx), "perfect-week")).toMatchObject({ unlocked: true, unlockedOn: "2026-11-15", current: 1, target: 1 });
		const miss = mk("2026-11-19", ["2026-11-09", "2026-11-11"], [q("2026-11-09")]);
		expect(get(badges(miss, ctx), "perfect-week").unlocked).toBe(false);
	});
	it("streak badges stay earned from best; unlockedOn is the goal-th workout of the reaching week", () => {
		const h = mk("2026-11-19", [], [q("2026-11-02"), q("2026-11-03"), q("2026-11-09"), q("2026-11-10")]);
		const l = badges(h, ctx);
		expect(get(l, "streak-2")).toMatchObject({ unlocked: true, unlockedOn: "2026-11-10" });
		expect(get(l, "streak-4")).toMatchObject({ unlocked: false, current: 2, remaining: 2 });
	});
	it("nextBadges orders by progress then remaining; recentBadges newest first", () => {
		const h = mk("2026-11-19", [], [q("2026-11-16", "a", 5), q("2026-11-18", "b", 9)]);
		const l = badges(h, ctx);
		const next = nextBadges(l, 12);
		expect(next.every((b) => !b.unlocked)).toBe(true);
		const ratios = next.map((b) => b.current / b.target);
		expect([...ratios].sort((a, b) => b - a)).toEqual(ratios);
		expect(recentBadges(l, 5).map((b) => b.id)).toEqual(["first-pr", "first-workout"]);
	});
	it("badgeProgressDelta: perfect-week 1 -> 2 of 3 after the second workout of the week", () => {
		const plan = ["2026-11-16", "2026-11-17", "2026-11-18"];
		const before = badges(mk("2026-11-17", plan, [q("2026-11-16")]), ctx);
		const after = badges(mk("2026-11-17", plan, [q("2026-11-16"), q("2026-11-17")]), ctx);
		const d = badgeProgressDelta(before, after);
		expect(d.find((x) => x.id === "perfect-week")).toEqual({ id: "perfect-week", from: 1, to: 2, target: 3, unlocked: false });
		expect(d.find((x) => x.id === "first-workout")).toBeUndefined();
	});
});
