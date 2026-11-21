import { describe, expect, it } from "vitest";
import { achievements, nearestAchievements } from "@/lib/progress/achievements";
import { periodSummary } from "@/lib/progress/summary";
import type { History, IsoDate, WorkoutSession } from "@/lib/progress/types";
import { levelFor, xpAndLevel } from "@/lib/progress/xp";

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
	device: null,
};
const empty: History = { ...base, plan: [], sessions: [] };

describe("xp", () => {
	it("рівні: 0→1, 100→2, 299→2, 300→3, 1000→5", () => {
		expect([0, 100, 299, 300, 1000].map((x) => levelFor(x))).toEqual([1, 2, 2, 3, 5]);
	});
	it("XP: 2 якісні тренування, 1 рекорд, 3 дотримані відпочинки = 270", () => {
		expect(xpAndLevel(base)).toEqual({ xp: 270, level: 2, levelStartXp: 100, nextLevelXp: 300 });
	});
	it("два тренування за день — XP лише за одне", () => {
		const two: History = {
			...base,
			plan: [{ date: "2026-11-16", type: "workout" }],
			sessions: [session("2026-11-16"), { ...session("2026-11-16"), id: "s-2" }],
		};
		expect(xpAndLevel(two).xp).toBe(100);
	});
	it("позапланове тренування в день відпочинку не дає 20 XP", () => {
		const extra: History = { ...base, sessions: [...base.sessions, session("2026-11-17", { planned: false, id: "x" })] };
		expect(xpAndLevel(extra).xp).toBe(250);
	});
	it("порожня історія: рівень 1", () => {
		expect(xpAndLevel(empty)).toEqual({ xp: 0, level: 1, levelStartXp: 0, nextLevelXp: 100 });
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

describe("achievements", () => {
	it("порядок, current <= target, відкриті", () => {
		const list = achievements(base);
		expect(list.map((a) => a.id)[0]).toBe("first_workout");
		expect(list.every((a) => a.current <= a.target)).toBe(true);
		expect(list.find((a) => a.id === "first_workout")?.unlocked).toBe(true);
		expect(list.find((a) => a.id === "first_pr")?.unlocked).toBe(true);
		expect(list.find((a) => a.id === "workouts_5")?.current).toBe(2);
	});
	it("nearest без відкритих, за прогресом спадно", () => {
		const near = nearestAchievements(achievements(base), 3);
		expect(near).toHaveLength(3);
		expect(near.every((a) => !a.unlocked)).toBe(true);
		const ratios = near.map((a) => a.current / a.target);
		expect([...ratios].sort((a, b) => b - a)).toEqual(ratios);
	});
	it("first_plan_week і rest_4_weeks", () => {
		const weekly: History = {
			...base,
			plan: [
				{ date: "2026-11-09", type: "workout" },
				{ date: "2026-11-10", type: "rest" },
			],
			sessions: [session("2026-11-09")],
		};
		const list = achievements(weekly);
		expect(list.find((a) => a.id === "first_plan_week")?.unlocked).toBe(true);
		expect(list.find((a) => a.id === "rest_4_weeks")?.current).toBe(1);
	});
});
