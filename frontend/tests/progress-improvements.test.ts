import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advice, improvements } from "@/lib/progress/improvements";
import type { Exercise, History, PlannedDay, ProgressContext, SetLog, WorkoutSession } from "@/lib/progress/types";

const exercises: Exercise[] = [{ id: "pushup", name: "Push-up", kind: "bodyweight" }];
const ctx: ProgressContext = { weeklyGoal: 3, pauses: [] };
const bw = (reps: number): SetLog => ({ exerciseId: "pushup", reps, weightKg: null, durationSec: null });
function sess(id: string, date: string, reps: number): WorkoutSession {
	return { id, date, planned: true, status: "completed", adapted: false, durationMin: 30, setsPlanned: 1, sets: [bw(reps)], rpe: null };
}
const hist = (sessions: WorkoutSession[], plan: PlannedDay[] = [], today = "2026-11-21"): History => ({ today, exercises, plan, sessions, body: [], checkIns: [], device: null });

describe("improvements", () => {
	it("pushups 15 -> 18 over 4 weeks", () => {
		const h = hist([sess("a", "2026-10-20", 15), sess("b", "2026-11-18", 18)]);
		expect(improvements(h, ctx)).toContainEqual({ kind: "record", exerciseId: "pushup", metric: "reps", now: 18, before: 15, delta: 3 });
	});
	it("never more than 2, only positive", () => {
		const plan: PlannedDay[] = [];
		const sessions = [sess("a", "2026-10-20", 15), sess("b", "2026-11-18", 18), sess("c", "2026-11-10", 20), sess("d", "2026-11-05", 21)];
		const out = improvements(hist(sessions, plan), ctx);
		expect(out.length).toBeLessThanOrEqual(2);
		expect(out.every((i) => i.delta > 0)).toBe(true);
	});
	it("no growth -> empty", () => {
		expect(improvements(hist([sess("a", "2026-10-20", 15), sess("b", "2026-11-18", 12)]), ctx)).toEqual([]);
	});
});

describe("advice", () => {
	it("new user: start tip", () => {
		expect(advice(hist([]), ctx)).toEqual({ id: "start", vars: {} });
	});
	it("goal remaining beats others", () => {
		// today Sat 2026-11-21; week starts Mon 11-16; one quality session -> 2 remaining, 2 days left
		const h = hist([sess("a", "2026-11-17", 10)]);
		expect(advice(h, ctx)).toEqual({ id: "goal-remaining", vars: { n: 2 } });
	});
	it("goal unreachable -> falls through", () => {
		const a = advice(hist([sess("a", "2026-11-10", 10)]), { weeklyGoal: 5, pauses: [] });
		expect(a?.id).not.toBe("goal-remaining");
	});
	it("near record", () => {
		const h = hist([sess("a", "2026-10-01", 20), sess("b", "2026-11-18", 19), sess("e", "2026-11-19", 19)]);
		expect(advice(h, { weeklyGoal: 2, pauses: [] })).toEqual({ id: "near-record", vars: { exerciseId: "pushup", exercise: "Push-up", target: 20 } });
	});
	it("plateau", () => {
		const h = hist([sess("o", "2026-10-01", 20), sess("a", "2026-11-09", 10), sess("b", "2026-11-12", 10), sess("c", "2026-11-14", 10), sess("d", "2026-11-17", 10), sess("e", "2026-11-18", 10)]);
		expect(advice(h, { weeklyGoal: 2, pauses: [] })).toEqual({ id: "plateau", vars: { exerciseId: "pushup", exercise: "Push-up" } });
	});
	it("templates exist in en.json", () => {
		const en = JSON.parse(readFileSync("messages/en.json", "utf8")).fit.progress;
		for (const id of ["start", "plateau", "goal-remaining", "near-record"]) expect(typeof en.advice[id]).toBe("string");
		for (const k of ["record", "consistency", "streak"]) expect(typeof en.improvements[k]).toBe("string");
	});
});

describe("improvements (more)", () => {
	const ex2: Exercise[] = [
		{ id: "a", name: "A", kind: "bodyweight" },
		{ id: "b", name: "B", kind: "bodyweight" },
		{ id: "c", name: "C", kind: "bodyweight" },
	];
	const set = (exerciseId: string, reps: number): SetLog => ({ exerciseId, reps, weightKg: null, durationSec: null });
	const multi = (id: string, date: string, reps: Record<string, number>): WorkoutSession => ({
		id, date, planned: true, status: "completed", adapted: false, durationMin: 30, setsPlanned: Object.keys(reps).length,
		sets: Object.entries(reps).map(([e, r]) => set(e, r)), rpe: null,
	});
	const h3 = (sessions: WorkoutSession[], today = "2026-11-21"): History => ({ today, exercises: ex2, plan: [], sessions, body: [], checkIns: [], device: null });

	it("3 candidates: ordered by relative gain, capped at 2", () => {
		const h = h3([multi("o", "2026-10-20", { a: 10, b: 10, c: 10 }), multi("n", "2026-11-18", { a: 11, b: 20, c: 15 })]);
		const out = improvements(h, ctx).filter((i) => i.kind === "record");
		expect(out.map((i) => (i.kind === "record" ? i.exerciseId : ""))).toEqual(["b", "c"]);
	});
	it("consistency and streak kinds", () => {
		// Two planned workouts per week; older weeks (10-05, 10-12) half done, recent weeks (10-26..11-16) fully done.
		const planned = ["10-05", "10-06", "10-12", "10-13", "10-26", "10-27", "11-02", "11-03", "11-09", "11-10", "11-16", "11-17"].map((d) => `2026-${d}`);
		const done = planned.filter((d) => !["2026-10-06", "2026-10-13"].includes(d));
		const h: History = { ...h3(done.map((d) => multi(`s${d}`, d, { a: 5 }))), plan: planned.map((d) => ({ date: d, type: "workout" as const })) };
		const kinds = improvements(h, { weeklyGoal: 2, pauses: [] }).map((i) => i.kind);
		expect(kinds).toContain("streak");
		expect(kinds).toContain("consistency");
	});
	it("baseline ignores sessions after the cutoff", () => {
		// Only post-cutoff sessions exist: the 28-days-ago baseline must have no streak/consistency.
		const dates = ["2026-11-16", "2026-11-17"];
		const h: History = { ...h3(dates.map((d) => multi(`s${d}`, d, { a: 5 }))), plan: dates.map((d) => ({ date: d, type: "workout" as const })) };
		const out = improvements(h, { weeklyGoal: 2, pauses: [] });
		expect(out.find((i) => i.kind === "streak")).toMatchObject({ before: 0, now: 1 });
	});
});

describe("advice (more)", () => {
	it("near-record picks the exercise closest to its record", () => {
		const exs: Exercise[] = [{ id: "a", name: "A", kind: "bodyweight" }, { id: "b", name: "B", kind: "bodyweight" }];
		const s = (id: string, date: string, a: number, b: number): WorkoutSession => ({
			id, date, planned: true, status: "completed", adapted: false, durationMin: 30, setsPlanned: 2,
			sets: [{ exerciseId: "a", reps: a, weightKg: null, durationSec: null }, { exerciseId: "b", reps: b, weightKg: null, durationSec: null }], rpe: null,
		});
		// a: record 100, recent 95 (5% gap); b: record 100, recent 99 (1% gap)
		const h: History = { today: "2026-11-21", exercises: exs, plan: [], sessions: [s("o", "2026-10-01", 100, 100), s("n", "2026-11-18", 95, 99), s("m", "2026-11-19", 95, 99)], body: [], checkIns: [], device: null };
		expect(advice(h, { weeklyGoal: 2, pauses: [] })).toMatchObject({ id: "near-record", vars: { exerciseId: "b" } });
	});
	it("non-finite weeklyGoal falls back to 3", () => {
		const h = hist([sess("a", "2026-11-17", 10)]);
		expect(advice(h, { weeklyGoal: NaN, pauses: [] })).toEqual({ id: "goal-remaining", vars: { n: 2 } });
	});
});
