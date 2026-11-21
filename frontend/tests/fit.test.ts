import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAdapt } from "@/lib/fit/adapt";
import { coachReply, isSafetyConcern, type CoachContext } from "@/lib/fit/coach";
import { chatHistory, mergeProfile, planSummaryText, profileDiff } from "@/lib/fit/coachChat";
import { toISO } from "@/lib/fit/dates";
import { DEFAULT_TRAINER_ID, activeTrainerId } from "@/lib/fit/options";
import { estimateMinutes, generatePlan, nextUpcoming } from "@/lib/fit/plan";
import { emptyState } from "@/lib/fit/seed";
import { loadState } from "@/lib/fit/store/persist";
import { progressOf } from "@/lib/fit/store/progressStats";
import { reducer, type Action } from "@/lib/fit/store/reducer";
import type { FitState, PlannedWorkout, Profile } from "@/lib/fit/types";

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
		// The engine judges achievements now: legacy fields are not written, the finish is reflected in lib/progress.
		expect(s.unlocked).toEqual({});
		expect(s.celebrate).toEqual([]);
		expect(s.history[s.history.length - 1]?.xp).toBeGreaterThan(0);
		expect(progressOf(s, today).badges.find((b) => b.id === "first-workout")?.unlocked).toBe(true);
	});
	it("skipping an upcoming workout never breaks the (weekly) streak", () => {
		const s = run(emptyState(), { type: "complete-onboarding", units: "metric", profile, demoHistory: true, today, now });
		const before = progressOf(s, today).streak.current;
		const next = nextUpcoming(s.planned, today);
		const skipped = run(s, { type: "skip-planned", id: next?.id ?? "", reason: "recovery" });
		expect(progressOf(skipped, today).streak.current).toBeGreaterThanOrEqual(before);
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
	const ctx: CoachContext = { profile, next: undefined, todayDone: false, inSession: false, streak: 2, weekDone: 1, weekPlanned: 3, consistency: 80, xp: 300, level: 2, sessions: 6, lastPr: null, premium: false };
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

describe("trainer and goal text", () => {
	const withProfile: FitState = { ...emptyState(), profile, planned: generatePlan(profile, today, 4) };

	it("set-trainer stores the id", () => {
		expect(run(withProfile, { type: "set-trainer", trainerId: "mike" }).trainerId).toBe("mike");
	});
	it("set-goal updates goal and goalText and rebuilds upcoming workouts like update-profile", () => {
		const next = run(withProfile, { type: "set-goal", goal: "endurance", goalText: "run a half marathon", today });
		expect(next.profile?.goal).toBe("endurance");
		expect(next.profile?.goalText).toBe("run a half marathon");
		const viaUpdate = run(withProfile, { type: "update-profile", profile: { ...profile, goal: "endurance", goalText: "run a half marathon" }, units: "metric", today });
		// Plan ids are generated, so compare the stable shape: profile, and which days carry which kind of workout.
		expect(next.profile).toEqual(viaUpdate.profile);
		expect(next.planned.map((w) => [w.date, w.title])).toEqual(viaUpdate.planned.map((w) => [w.date, w.title]));
	});
	it("set-goal is a no-op without a profile", () => {
		const empty = emptyState();
		expect(run(empty, { type: "set-goal", goal: "endurance", goalText: "x", today })).toBe(empty);
	});
	it("activeTrainerId falls back to john when nothing is stored", () => {
		expect(activeTrainerId({ ...emptyState(), trainerId: null })).toBe(DEFAULT_TRAINER_ID);
		expect(DEFAULT_TRAINER_ID).toBe("john");
		expect(activeTrainerId({ ...emptyState(), trainerId: "alex" })).toBe("alex");
	});
});

describe("goalText survives preference edits", () => {
	const base: FitState = { ...emptyState(), profile: { ...profile, goalText: "run a half marathon" }, planned: generatePlan(profile, today, 4) };
	it("update-profile keeps goalText when the edit form does not carry it and the goal is unchanged", () => {
		const { goalText: _drop, ...edited } = { ...profile, daysPerWeek: 5 };
		expect(run(base, { type: "update-profile", profile: edited, units: "metric", today }).profile?.goalText).toBe("run a half marathon");
	});
	it("update-profile drops goalText when the preset goal itself was changed", () => {
		const { goalText: _drop, ...edited } = { ...profile, goal: "lose-fat" as const };
		expect(run(base, { type: "update-profile", profile: edited, units: "metric", today }).profile?.goalText).toBeUndefined();
	});
});

describe("AI plan state", () => {
	const aiSession = (id: string, date: string): PlannedWorkout => {
		const base = generatePlan(profile, today, 4)[0];
		if (!base) throw new Error("no workout");
		return { ...base, id, date, title: "AI session", status: "planned" };
	};
	const tomorrow = toISO(new Date(Date.now() + 86_400_000));
	const nextWeek = toISO(new Date(Date.now() + 7 * 86_400_000));

	afterEach(() => vi.unstubAllGlobals());

	it("apply-ai-plan keeps history, completed and adHoc sessions", () => {
		let s = run(emptyState(), { type: "complete-onboarding", units: "metric", profile, demoHistory: true, today, now });
		const todays = aiSession("ai-today-old", today);
		s = { ...s, planned: [...s.planned.filter((w) => w.date !== today), { ...todays, id: "done-today", status: "completed" }] };
		s = run(s, { type: "add-adhoc", kind: "mobility", today });
		const pastBefore = s.planned.filter((w) => w.date < today);
		const historyBefore = s.history;
		const adHocIds = s.planned.filter((w) => w.adHoc).map((w) => w.id);
		const out = run(s, { type: "apply-ai-plan", planned: [aiSession("ai-1", today), aiSession("ai-2", tomorrow), aiSession("ai-3", nextWeek)], summary: "Built for you", source: "ai", wishes: ["more core"], today });
		expect(out.history).toEqual(historyBefore);
		expect(out.planned.filter((w) => w.date < today)).toEqual(pastBefore);
		expect(out.planned.find((w) => w.id === "done-today")?.status).toBe("completed");
		for (const id of adHocIds) expect(out.planned.some((w) => w.id === id)).toBe(true);
		const future = out.planned.filter((w) => w.status === "planned" && w.date >= today && !w.adHoc);
		expect(future.map((w) => w.id).sort()).toEqual(["ai-1", "ai-2", "ai-3"]);
		expect(out.planSource).toBe("ai");
		expect(out.planSummary).toBe("Built for you");
		expect(out.planWishes).toEqual(["more core"]);
		expect(out.daily).toBeNull();
	});

	it("apply-daily replaces the session and undo restores it", () => {
		const original = aiSession("w1", tomorrow);
		const lighter = { ...original, title: "Lighter", durationMin: 20 };
		const s0: FitState = { ...emptyState(), profile, planned: [original] };
		const check = { date: today, status: "lighter" as const, note: "Tired", stats: null, sessionId: "w1" };
		const s1 = run(s0, { type: "apply-daily", check, session: lighter });
		expect(s1.planned[0]?.title).toBe("Lighter");
		expect(s1.daily?.original).toEqual(original);
		expect(s1.daily?.undone).toBe(false);
		const s2 = run(s1, { type: "undo-daily" });
		expect(s2.planned[0]).toEqual(original);
		expect(s2.daily?.undone).toBe(true);
		expect(run(s2, { type: "undo-daily" })).toBe(s2);
		const s3 = run(s0, { type: "apply-daily", check: { ...check, status: "unchanged", sessionId: null }, session: null });
		expect(s3.daily?.original).toBeNull();
		expect(s3.planned).toEqual(s0.planned);
		expect(run(s3, { type: "undo-daily" })).toBe(s3);
	});

	it("apply-daily keeps the first original across repeated checks", () => {
		const original = aiSession("w1", tomorrow);
		const s0: FitState = { ...emptyState(), profile, planned: [original] };
		const check = { date: today, status: "lighter" as const, note: "Tired", stats: null, sessionId: "w1" };
		const bad = { ...original, title: "Recovery" };
		const tired = { ...original, title: "Lighter" };
		const s1 = run(s0, { type: "apply-daily", check: { ...check, status: "recovery" }, session: bad }, { type: "apply-daily", check, session: tired });
		expect(s1.planned[0]?.title).toBe("Lighter");
		expect(s1.daily?.original).toEqual(original);
		expect(run(s1, { type: "undo-daily" }).planned[0]).toEqual(original);
	});

	it("an unchanged daily check reverts today's earlier adjustment", () => {
		const original = aiSession("w1", tomorrow);
		const s0: FitState = { ...emptyState(), profile, planned: [original] };
		const check = { date: today, status: "lighter" as const, note: "Tired", stats: null, sessionId: "w1" };
		const s1 = run(s0, { type: "apply-daily", check, session: { ...original, title: "Lighter" } });
		const s2 = run(s1, { type: "apply-daily", check: { ...check, status: "unchanged", sessionId: null }, session: null });
		expect(s2.planned[0]).toEqual(original);
		expect(s2.daily?.status).toBe("unchanged");
		expect(s2.daily?.original).toBeNull();
	});

	it("coach chat helpers: profile diff, merge, plan summary and history", () => {
		const changes = { location: "home" as const, daysPerWeek: profile.daysPerWeek };
		expect(profileDiff(profile, changes).map((c) => c.field)).toEqual(profile.location === "home" ? [] : ["location"]);
		expect(profileDiff(profile, null)).toEqual([]);
		expect(mergeProfile(profile, changes).location).toBe("home");
		expect(mergeProfile(profile, null)).toBe(profile);
		const near = aiSession("near", tomorrow);
		const far = aiSession("far", toISO(new Date(Date.now() + 9 * 86_400_000)));
		const text = planSummaryText([far, near, { ...aiSession("done", today), status: "completed" }], today);
		expect(text.split("\n")).toHaveLength(1);
		expect(text.startsWith(`${tomorrow} AI session: `)).toBe(true);
		const many = Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, from: "user" as const, text: "x".repeat(700), at: now }));
		const history = chatHistory(many);
		expect(history).toHaveLength(12);
		expect(history[0]?.text).toHaveLength(600);
	});

	it("chat history for the AI leaves out symptom messages and safety replies", () => {
		const msg = (from: "user" | "coach", text: string, safety?: boolean) => ({ id: text, from, text, at: now, safety });
		const history = chatHistory([msg("user", "I have chest pain"), msg("coach", "Please stop", true), msg("user", "fewer leg days")]);
		expect(history).toEqual([{ from: "user", text: "fewer leg days" }]);
		expect(chatHistory([msg("user", "more cardio"), msg("user", "I feel dizzy")])).toEqual([]);
		expect(chatHistory([msg("user", "more cardio"), msg("coach", "Sure")])).toEqual([]);
	});

	it("old saved state without new fields loads with defaults", () => {
		const old = { version: 1, units: "metric", profile: null, trainerId: null, planned: [], history: [], active: null, notifications: [], water: {}, subscription: { tier: "free", trialEndsAt: null }, coach: [] };
		vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify(old), setItem: () => undefined } });
		const s = loadState();
		expect(s.backend).toBeNull();
		expect(s.planWishes).toEqual([]);
		expect(s.planSource).toBe("rules");
		expect(s.planSummary).toBeNull();
		expect(s.daily).toBeNull();
	});

	it("old saved state with a numeric-user backend drops it, so a device is registered under the token", () => {
		const old = { version: 1, units: "metric", profile: null, trainerId: null, planned: [], history: [], active: null, notifications: [], water: {}, subscription: { tier: "free", trialEndsAt: null }, coach: [], backend: { userId: 7, deviceId: 9 } };
		vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify(old), setItem: () => undefined } });
		expect(loadState().backend).toBeNull();
		const kept = { ...old, backend: { deviceId: 9 } };
		vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify(kept), setItem: () => undefined } });
		expect(loadState().backend).toEqual({ deviceId: 9 });
		// The same rule on hydrate (dev scenarios, restores).
		const legacy: FitState = JSON.parse(JSON.stringify({ ...emptyState(), backend: { userId: 7, deviceId: 9 } }));
		expect(run(emptyState(), { type: "hydrate", state: legacy }).backend).toBeNull();
	});

	it("complete-onboarding with ai uses the AI plan and stores the backend device", () => {
		const token = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
		for (const demoHistory of [false, true]) {
			const s = run(emptyState(), { type: "complete-onboarding", units: "metric", profile, demoHistory, today, now, planned: [aiSession("ai-a", tomorrow)], ai: { backend: { deviceId: 9 }, summary: "Hello", source: "fallback", progressToken: token } });
			expect(s.backend).toEqual({ deviceId: 9 });
			expect(s.progressToken).toBe(token);
			expect(s.planSummary).toBe("Hello");
			expect(s.planSource).toBe("fallback");
			expect(s.planned.some((w) => w.id === "ai-a")).toBe(true);
			expect(s.planned.some((w) => w.status === "planned" && w.date >= today && w.id !== "ai-a" && !w.adHoc)).toBe(false);
			const plain = run(emptyState(), { type: "complete-onboarding", units: "metric", profile, demoHistory, today, now });
			expect(plain.planSource).toBe("rules");
			expect(plain.planSummary).toBeNull();
			expect(plain.backend).toBeNull();
		}
	});

	it("plan-replacing actions clear today's daily check so it runs again", () => {
		const w = { ...aiSession("w1", today), title: "Recovery" };
		const daily = { date: today, status: "recovery" as const, note: "Rest", stats: null, sessionId: "w1", original: aiSession("w1", today), undone: false };
		const s0: FitState = { ...emptyState(), profile: { ...profile, equipment: ["dumbbells", "bench"] }, planned: [w], daily, subscription: { tier: "premium", trialEndsAt: null } };
		expect(run(s0, { type: "update-profile", profile: { ...profile, daysPerWeek: 4 }, units: "metric", today }).daily).toBeNull();
		expect(run(s0, { type: "set-goal", goal: "lose-fat", goalText: "", today }).daily).toBeNull();
		const reply = { id: "r", from: "coach" as const, text: "ok", at: now };
		const apply = (action: Extract<Action, { type: "coach-apply" }>["action"]) => run(s0, { type: "coach-apply", messageId: "m", action, today, now, reply }).daily;
		expect(apply({ id: "a", label: "x", type: "remove-equipment", equipment: "dumbbells" })).toBeNull();
		expect(apply({ id: "b", label: "x", type: "avoid-limitation", limitation: "knees" })).toBeNull();
		expect(apply({ id: "c", label: "x", type: "rebuild-plan", premium: true })).toBeNull();
	});

	it("update-profile sets planSource rules and set-backend stores ids", () => {
		const s0: FitState = { ...emptyState(), profile, planned: generatePlan(profile, today, 4), planSource: "ai" };
		expect(run(s0, { type: "update-profile", profile: { ...profile, daysPerWeek: 4 }, units: "metric", today }).planSource).toBe("rules");
		// A rule-built plan has no trainer summary, so the AI summary card does not describe a plan it didn't make.
		expect(run({ ...s0, planSummary: "AI week" }, { type: "update-profile", profile: { ...profile, daysPerWeek: 4 }, units: "metric", today }).planSummary).toBeNull();
		expect(run(s0, { type: "set-backend", backend: { deviceId: 2 } }).backend).toEqual({ deviceId: 2 });
	});
});
