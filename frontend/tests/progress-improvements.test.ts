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
const hist = (sessions: WorkoutSession[], plan: PlannedDay[] = [], today = "2026-11-21"): History => ({ today, exercises, plan, sessions, body: [], device: null });

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
