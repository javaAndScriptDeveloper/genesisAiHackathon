import { describe, expect, it } from "vitest";
import { demoHistory } from "@/lib/api/mock/progressDb";
import { addDays } from "@/lib/progress/dates";
import { isValidReportWeek, weeklyReport, weeklyReportV2 } from "@/lib/progress/report";
import type { History, ProgressContext, WorkoutSession } from "@/lib/progress/types";

describe("isValidReportWeek", () => {
	const today = "2026-11-19";
	it("accepts a finished Monday week", () => expect(isValidReportWeek("2026-11-09", today)).toBe(true));
	it("rejects non-Monday", () => expect(isValidReportWeek("2026-11-17", today)).toBe(false));
	it("rejects the current, incomplete week", () => expect(isValidReportWeek("2026-11-16", today)).toBe(false));
	it("rejects malformed and impossible dates", () => {
		expect(isValidReportWeek("nope", today)).toBe(false);
		expect(isValidReportWeek("2026-11-9", today)).toBe(false);
		expect(isValidReportWeek("2026-02-30", today)).toBe(false);
	});
	it("accepts a week that ended yesterday", () => expect(isValidReportWeek("2026-11-09", "2026-11-16")).toBe(true));
	it("rejects when the Sunday is today", () => expect(isValidReportWeek("2026-11-09", "2026-11-15")).toBe(false));
});

describe("weeklyReport", () => {
	const h = demoHistory();
	const r = weeklyReport(h, "2026-11-09");
	it("summarises the week", () => expect(r.summary.workouts).toBe(3));
	it("includes the previous week summary", () => expect(r.previous.workouts).toBeGreaterThanOrEqual(0));
	it("keeps records inside the week", () => {
		for (const p of r.records) {
			expect(p.date >= "2026-11-09" && p.date <= "2026-11-15").toBe(true);
		}
	});
	it("plans the next week", () => {
		expect(r.nextWeek.weekStart).toBe("2026-11-16");
		expect(r.nextWeek.days).toHaveLength(7);
	});
	it("never reports consistency_up", () => {
		for (const w of ["2026-11-02", "2026-11-09"]) expect(weeklyReport(h, w).insight?.id).not.toBe("consistency_up");
	});
	it("insight is null or has an id", () => expect(r.insight === null || typeof r.insight.id === "string").toBe(true));
});

describe("weeklyReportV2", () => {
	const ctx: ProgressContext = { weeklyGoal: 3, pauses: [] };
	const q = (date: string, id = `s-${date}`): WorkoutSession => ({
		id, date, planned: true, status: "completed", adapted: false, durationMin: 30,
		setsPlanned: 10, sets: Array.from({ length: 10 }, () => ({ exerciseId: "squat", reps: 8, weightKg: 40, durationSec: null })), rpe: null,
	});
	const mk = (dates: string[]): History => ({
		today: "2026-12-31", exercises: [{ id: "squat", name: "Squat", kind: "weighted" }],
		plan: dates.map((date) => ({ date, type: "workout" as const })),
		sessions: dates.map((d) => q(d)), body: [], checkIns: [], device: null,
	});
	const MON = "2026-11-02"; // weeks: 10-12, 10-19, 10-26, 11-02

	it("recommendedGoal is the mean of 2/3/4/3 -> 3", () => {
		const week = (ws: string, n: number) => Array.from({ length: n }, (_, i) => addDays(ws, i));
		const h = mk([...week("2026-10-12", 2), ...week("2026-10-19", 3), ...week("2026-10-26", 4), ...week(MON, 3)]);
		expect(weeklyReportV2(h, ctx, MON).recommendedGoal).toBe(3);
	});
	it("clamps recommendedGoal to 2..5", () => {
		expect(weeklyReportV2(mk([MON]), ctx, MON).recommendedGoal).toBe(2);
		expect(weeklyReportV2(mk(Array.from({ length: 7 }, (_, i) => addDays(MON, i))), ctx, MON).recommendedGoal).toBe(5);
	});
	it("paused week is not credited", () => {
		const h = mk([MON, addDays(MON, 1), addDays(MON, 2)]);
		const r = weeklyReportV2(h, { ...ctx, pauses: [{ from: MON, to: addDays(MON, 6) }] }, MON);
		expect(r.paused).toBe(true);
		expect(r.credited).toBe(false);
		expect(weeklyReportV2(h, ctx, MON).credited).toBe(true);
	});
	it("summary, previous and push text", () => {
		const h = mk(["2026-10-26", MON, addDays(MON, 1), addDays(MON, 2)]);
		const r = weeklyReportV2(h, ctx, MON);
		expect(r.summary).toMatchObject({ workouts: 3, minutes: 90, qualitySets: 30 });
		expect(r.summary.xp).toBeGreaterThan(0);
		expect(r.previous).toMatchObject({ workouts: 1, minutes: 30, qualitySets: 10 });
		expect(r.pushText).toEqual({ key: "fit.progress.push.weekly", params: { done: 3, goal: 3, streak: 1 } });
	});
	it("an old week's report is unchanged by later sessions", () => {
		const base = mk(["2026-10-26", MON, addDays(MON, 1), addDays(MON, 2)]);
		const later = mk(["2026-10-26", MON, addDays(MON, 1), addDays(MON, 2), "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
		expect(weeklyReportV2(later, ctx, MON)).toEqual(weeklyReportV2(base, ctx, MON));
	});
	it("paused middle week is skipped and an older week pulled in", () => {
		const week = (ws: string, n: number) => Array.from({ length: n }, (_, i) => addDays(ws, i));
		// weeks: 10-12:5, 10-19:5, 10-26:(paused, 0), 11-02(report):3 -> mean of 3,5,5 = 4.33 -> 4 (a paused 0 would give 3)
		const h = mk([...week("2026-10-12", 5), ...week("2026-10-19", 5), ...week(MON, 3)]);
		const c: ProgressContext = { ...ctx, pauses: [{ from: "2026-10-26", to: "2026-11-01" }] };
		expect(weeklyReportV2(h, c, MON).recommendedGoal).toBe(4);
	});
	it("paused report week is not seeded", () => {
		const week = (ws: string, n: number) => Array.from({ length: n }, (_, i) => addDays(ws, i));
		const h = mk([...week("2026-10-19", 5), ...week("2026-10-26", 5), ...week(MON, 2)]);
		const c: ProgressContext = { ...ctx, pauses: [{ from: MON, to: addDays(MON, 6) }] };
		expect(weeklyReportV2(h, c, MON).recommendedGoal).toBe(5);
	});
	it("no non-paused weeks -> 2", () => {
		const h = mk([MON, addDays(MON, 1)]);
		const c: ProgressContext = { ...ctx, pauses: [{ from: MON, to: addDays(MON, 6) }] };
		expect(weeklyReportV2(h, c, MON).recommendedGoal).toBe(2);
	});
});
