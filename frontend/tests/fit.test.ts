import { describe, expect, it } from "vitest";
import { applyAdapt } from "@/lib/fit/adapt";
import { coachReply, isSafetyConcern, type CoachContext } from "@/lib/fit/coach";
import { toISO } from "@/lib/fit/dates";
import { estimateMinutes, generatePlan, nextUpcoming } from "@/lib/fit/plan";
import { emptyState } from "@/lib/fit/seed";
import { computeStreak } from "@/lib/fit/stats";
import { reducer, type Action } from "@/lib/fit/store/reducer";
import type { FitState, Profile } from "@/lib/fit/types";

const profile: Profile = {
	name: "Alex", age: 30, gender: null, heightCm: 178, weightKg: 80, goal: "build-muscle", experience: "intermediate",
	location: "home", equipment: ["dumbbells", "bench"], durationMin: 45, daysPerWeek: 3, limitations: [], limitationNote: "", wearable: "none",
};
const today = toISO(new Date());
const now = new Date().toISOString();

function run(state: FitState, ...actions: Action[]) {
	return actions.reduce(reducer, state);
}

describe("plan generation", () => {
	it("respects equipment and limitations", () => {
		const plan = generatePlan({ ...profile, equipment: [], limitations: ["knees"] }, today, 2);
		expect(plan.length).toBeGreaterThan(0);
		for (const w of plan) expect(w.exercises.length).toBeGreaterThan(2);
	});
	it("fits the requested duration roughly", () => {
		const plan = generatePlan({ ...profile, durationMin: 20 }, today, 1);
		for (const w of plan) expect(estimateMinutes(w.exercises)).toBeLessThanOrEqual(30);
	});
});

describe("adaptation", () => {
	it("shortens without touching completed sets", () => {
		const w = generatePlan(profile, today, 2)[0];
		if (!w) throw new Error("no workout");
		const blocks = w.exercises.map((b, i) => (i === 0 ? { ...b, sets: b.sets.map((s, n) => (n === 0 ? { ...s, done: true, reps: 10, weight: 20 } : s)) } : b));
		const res = applyAdapt(blocks, { kind: "shorten", minutes: 15 }, { profile, startIndex: 0 });
		expect(estimateMinutes(res.exercises)).toBeLessThanOrEqual(estimateMinutes(blocks));
		expect(res.exercises[0]?.sets[0]?.done).toBe(true);
	});
	it("makes it easier by lowering load", () => {
		const w = generatePlan(profile, today, 2)[0];
		if (!w) throw new Error("no workout");
		const res = applyAdapt(w.exercises, { kind: "too-hard" }, { profile, startIndex: 0 });
		expect(res.changed).toBe(true);
	});
});

describe("end to end journey", () => {
	it("onboard, train, adapt, finish, unlock and update progress", () => {
		let s = run(emptyState(), { type: "complete-onboarding", units: "metric", profile, demoHistory: true, today, now });
		expect(s.history.length).toBeGreaterThan(5);
		const before = s.history.length;
		const next = nextUpcoming(s.planned, today);
		expect(next).toBeDefined();
		s = run(s, { type: "start-workout", plannedId: next?.id ?? "", now });
		s = run(s, { type: "adapt", op: { kind: "too-hard" }, today });
		expect(s.active?.adaptations.length).toBe(1);
		// complete every set
		for (let i = 0; i < 200 && s.active && s.active.phase !== "summary"; i += 1) {
			const a = s.active;
			if (a.phase === "rest") s = run(s, { type: "skip-rest" });
			else {
				const set = a.exercises[a.index]?.sets.find((x) => !x.done);
				s = run(s, { type: "log-set", reps: set?.target ?? 10, weight: set?.targetWeight });
			}
		}
		expect(s.active?.phase).toBe("summary");
		s = run(s, { type: "finish", today, now });
		expect(s.active).toBeNull();
		expect(s.history.length).toBe(before + 1);
		expect(s.unlocked["first-rep"]).toBeDefined();
		expect(s.unlocked["adapt-overcome"]).toBeDefined();
		expect(s.celebrate.length).toBeGreaterThan(0);
	});
	it("recovery skip does not break the streak", () => {
		const s = run(emptyState(), { type: "complete-onboarding", units: "metric", profile, demoHistory: true, today, now });
		const before = computeStreak(s.planned, today).current;
		const next = nextUpcoming(s.planned, today);
		const skipped = run(s, { type: "skip-planned", id: next?.id ?? "", reason: "recovery" });
		expect(computeStreak(skipped.planned, today).current).toBeGreaterThanOrEqual(before);
	});
	it("removing dumbbells swaps exercises", () => {
		let s = run(emptyState(), { type: "complete-onboarding", units: "metric", profile, demoHistory: false, today, now });
		const action = { id: "eq", label: "x", type: "remove-equipment" as const, equipment: "dumbbells" as const };
		s = run(s, { type: "coach-message", message: { id: "m", from: "coach", text: "", at: now } }, { type: "coach-apply", messageId: "m", action, today, now, reply: { id: "r", from: "coach", text: "ok", at: now } });
		const ids = s.planned.filter((w) => w.status === "planned").flatMap((w) => w.exercises.map((b) => b.exerciseId));
		expect(s.profile?.equipment).not.toContain("dumbbells");
		expect(ids.some((id) => id.startsWith("db-") || id === "goblet-squat")).toBe(false);
	});
});

describe("coach", () => {
	const ctx: CoachContext = { profile, next: undefined, todayDone: false, inSession: false, streak: 2, weekDone: 1, weekPlanned: 3, consistency: 80, xp: 300, sessions: 6, lastPr: null, premium: false };
	it("prioritizes safety over adaptation", () => {
		expect(isSafetyConcern("I feel dizzy and have chest pain")).toBe(true);
		const r = coachReply("I feel dizzy", ctx);
		expect(r.safety).toBe(true);
		expect(r.actions).toHaveLength(0);
	});
	it("maps common requests to actions", () => {
		expect(coachReply("my workout is too difficult", ctx).actions[0]?.type).toBe("adapt");
		expect(coachReply("I don't have dumbbells", ctx).actions[0]?.type).toBe("remove-equipment");
		expect(coachReply("I only have 20 minutes", ctx).actions[0]).toMatchObject({ type: "adapt", op: { kind: "shorten", minutes: 20 } });
		expect(coachReply("I feel exhausted", ctx).actions.length).toBeGreaterThan(0);
	});
});
