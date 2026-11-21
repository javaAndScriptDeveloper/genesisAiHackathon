import { describe, expect, it, vi } from "vitest";
import type { AiDeps } from "@/lib/fit/aiClient";
import { dailyCheck, ensureBackend, rebuildPlan, simulateOutcome, tokenBackend } from "@/lib/fit/aiFlow";
import type { DailyResponse, PlanResponse } from "@/lib/fit/aiApi";
import { createGate, singleFlight } from "@/lib/fit/singleFlight";
import { fetchPersonalPlan } from "@/lib/api/plan";
import { toISO } from "@/lib/fit/dates";
import { generatePlan } from "@/lib/fit/plan";
import { emptyState } from "@/lib/fit/seed";
import { reducer } from "@/lib/fit/store/reducer";
import type { DailyStats, Scenario } from "@/lib/fit/dailyStats";
import type { FitState, PlannedWorkout, Profile } from "@/lib/fit/types";

const profile: Profile = {
	name: "Alex", age: 30, gender: null, heightCm: 178, weightKg: 80, goal: "build-muscle", experience: "intermediate",
	location: "home", equipment: ["dumbbells", "bench"], durationMin: 45, daysPerWeek: 3, limitations: [], limitationNote: "", wearable: "apple",
};
const today = toISO(new Date());
const future = (n: number) => toISO(new Date(Date.now() + n * 86_400_000));
const stats: DailyStats = { date: today, sleepHours: 5, sleepScore: 50, restingHr: 70, hrvMs: 40, steps: 1000, activeKcal: 100, readiness: 30, source: "demo", scenario: "tired" };

const base = generatePlan(profile, today, 4)[0] as PlannedWorkout;
const todays: PlannedWorkout = { ...base, id: "w-today", date: today, status: "planned", adHoc: false };
const later: PlannedWorkout = { ...base, id: "w-later", date: future(2), status: "planned" };
const done: PlannedWorkout = { ...base, id: "w-done", date: future(3), status: "completed" };

function fakes(over: Partial<AiDeps> = {}): AiDeps {
	return {
		saveUser: vi.fn(async () => true),
		createDevice: vi.fn(async () => 9),
		syncDevice: vi.fn(async () => stats),
		requestPlan: vi.fn(async (): Promise<PlanResponse> => ({ planned: [todays], summary: "s", why: [], createdBy: "ai", trainingId: 1 })),
		requestDaily: vi.fn(async (): Promise<DailyResponse> => ({ status: "unchanged", session: null, note: "ok", stats, createdBy: "ai" })),
		requestCoach: vi.fn(),
		...over,
	};
}
const TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ctx = { profile, trainerSlug: "john", today, token: TOKEN };

describe("ensureBackend", () => {
	it("reuses an existing device", async () => {
		const deps = fakes();
		expect(await ensureBackend(deps, { ...ctx, backend: { deviceId: 2 } })).toEqual({ deviceId: 2 });
		expect(deps.saveUser).not.toHaveBeenCalled();
		expect(deps.syncDevice).not.toHaveBeenCalled();
	});
	it("saves the user under the token, then creates a device and syncs it", async () => {
		const deps = fakes();
		expect(await ensureBackend(deps, { ...ctx, backend: null })).toEqual({ deviceId: 9 });
		expect(deps.saveUser).toHaveBeenCalledWith(profile, "john", TOKEN);
		expect(deps.createDevice).toHaveBeenCalledWith(TOKEN, "Apple Watch");
		expect(deps.syncDevice).toHaveBeenCalledWith(TOKEN, 9, today);
	});
	it("returns null when the user cannot be saved or the device call rejects", async () => {
		const notSaved = fakes({ saveUser: vi.fn(async () => false) });
		expect(await ensureBackend(notSaved, { ...ctx, backend: null })).toBeNull();
		expect(notSaved.createDevice).not.toHaveBeenCalled();
		expect(await ensureBackend(fakes({ createDevice: vi.fn(async () => { throw new Error("down"); }) }), { ...ctx, backend: null })).toBeNull();
	});
});

describe("tokenBackend", () => {
	it("keeps a token-scoped device and drops a saved numeric-user backend", () => {
		expect(tokenBackend({ deviceId: 4 })).toEqual({ deviceId: 4 });
		expect(tokenBackend({ userId: 7, deviceId: 9 })).toBeNull();
		expect(tokenBackend(null)).toBeNull();
		expect(tokenBackend(undefined)).toBeNull();
		expect(tokenBackend({ deviceId: "9" })).toBeNull();
	});
});

describe("rebuildPlan", () => {
	it("returns null when the request fails", async () => {
		const deps = fakes({ requestPlan: vi.fn(async () => { throw new Error("x"); }) });
		expect(await rebuildPlan(deps, { ...ctx, wishes: [] })).toBeNull();
	});
	it("sends the progress token with the request", async () => {
		const deps = fakes();
		await rebuildPlan(deps, { ...ctx, wishes: ["a"] });
		expect(deps.requestPlan).toHaveBeenCalledWith(TOKEN, { profile, trainerSlug: "john", wishes: ["a"], today });
	});
});

describe("dailyCheck", () => {
	const s = { ...ctx, backend: { deviceId: 2 }, planned: [todays, later, done], wishes: [] as string[], daily: null };
	it("runs once per date unless forced", async () => {
		const deps = fakes();
		const first = await dailyCheck(deps, s);
		expect(first?.check).toMatchObject({ date: today, status: "unchanged", note: "ok", sessionId: "w-today" });
		const again = { ...s, daily: first ? { ...first.check, original: null, undone: false } : null };
		const deps2 = fakes();
		expect(await dailyCheck(deps2, again)).toBeNull();
		expect(deps2.syncDevice).not.toHaveBeenCalled();
		expect(deps2.requestDaily).not.toHaveBeenCalled();
		expect(await dailyCheck(deps2, { ...again, force: true })).not.toBeNull();
	});
	it("returns null without a backend", async () => {
		expect(await dailyCheck(fakes(), { ...s, backend: null })).toBeNull();
	});
	it("still asks for the daily result when sync fails, and nulls when it fails", async () => {
		const deps = fakes({ syncDevice: vi.fn(async () => { throw new Error("x"); }) });
		expect(await dailyCheck(deps, s)).not.toBeNull();
		expect(await dailyCheck(fakes({ requestDaily: vi.fn(async () => { throw new Error("x"); }) }), s)).toBeNull();
	});
	it("sends today's session and future sessions, with scenario passed to sync", async () => {
		const deps = fakes();
		await dailyCheck(deps, { ...s, scenario: "tired" });
		expect(deps.syncDevice).toHaveBeenCalledWith(TOKEN, 2, today, "tired");
		expect(deps.requestDaily).toHaveBeenCalledWith(TOKEN, { profile, trainerSlug: "john", session: todays, upcoming: [later], wishes: [], today });
	});
	it("after rebuild on a bad day the forced check runs again and replaces today", async () => {
		const recovery: PlannedWorkout = { ...todays, title: "Recovery", durationMin: 15 };
		let state: FitState = { ...emptyState(), profile, planned: [todays, later], daily: { date: today, status: "unchanged", note: "", stats: null, sessionId: "w-today", original: null, undone: false } };
		state = reducer(state, { type: "apply-ai-plan", planned: [todays, later], summary: "s", source: "ai", wishes: [], today });
		expect(state.daily).toBeNull();
		const deps = fakes({ requestDaily: vi.fn(async (): Promise<DailyResponse> => ({ status: "recovery", session: recovery, note: "rest", stats, createdBy: "ai" })) });
		const result = await dailyCheck(deps, { ...ctx, backend: { deviceId: 2 }, planned: state.planned, wishes: [], daily: state.daily, force: true });
		expect(deps.requestDaily).toHaveBeenCalledTimes(1);
		if (!result) throw new Error("expected result");
		state = reducer(state, { type: "apply-daily", ...result });
		expect(state.planned.find((w) => w.date === today)?.title).toBe("Recovery");
		expect(state.daily?.status).toBe("recovery");
	});
	it("re-checking an adjusted day sends the original session, not the adjusted one", async () => {
		const adjusted: PlannedWorkout = { ...todays, title: "Lighter", durationMin: 20 };
		const daily = { date: today, status: "lighter" as const, note: "", stats, sessionId: "w-today", original: todays, undone: false };
		const deps = fakes();
		await dailyCheck(deps, { ...s, planned: [adjusted, later, done], daily, scenario: "bad-night", force: true });
		expect(deps.requestDaily).toHaveBeenCalledWith(TOKEN, expect.objectContaining({ session: todays, upcoming: [later] }));
		const deps2 = fakes();
		await dailyCheck(deps2, { ...s, planned: [adjusted, later, done], daily: { ...daily, undone: true }, force: true });
		expect(deps2.requestDaily).toHaveBeenCalledWith(TOKEN, expect.objectContaining({ session: adjusted }));
	});
	it("a bad night survives the forced check after a rebuild (sync without scenario keeps the day)", async () => {
		// A fake device that behaves like the backend: no scenario keeps the existing row for the date.
		const nights = new Map<string, Scenario>();
		const syncDevice = vi.fn(async (_t: string, _d: number, date: string, scenario?: Scenario) => {
			if (scenario || !nights.has(date)) nights.set(date, scenario ?? "normal");
			return { ...stats, scenario: nights.get(date) ?? "normal" };
		});
		const recovery: PlannedWorkout = { ...todays, title: "Recovery", durationMin: 15 };
		const requestDaily = vi.fn(async (): Promise<DailyResponse> =>
			nights.get(today) === "bad-night" ? { status: "recovery", session: recovery, note: "rest", stats, createdBy: "ai" } : { status: "unchanged", session: null, note: "ok", stats, createdBy: "ai" },
		);
		const deps = fakes({ syncDevice, requestDaily });
		let state: FitState = { ...emptyState(), profile, planned: [todays, later] };
		const first = await dailyCheck(deps, { ...s, planned: state.planned, daily: null, scenario: "bad-night", force: true });
		if (!first) throw new Error("expected result");
		state = reducer(state, { type: "apply-daily", ...first });
		state = reducer(state, { type: "apply-ai-plan", planned: [todays, later], summary: "s", source: "ai", wishes: [], today });
		const again = await dailyCheck(deps, { ...s, planned: state.planned, daily: state.daily, force: true });
		expect(syncDevice).toHaveBeenLastCalledWith(TOKEN, 2, today, undefined);
		if (!again) throw new Error("expected result");
		state = reducer(state, { type: "apply-daily", ...again });
		expect(state.daily?.status).toBe("recovery");
		expect(state.planned.find((w) => w.date === today)?.title).toBe("Recovery");
	});
});

describe("simulateOutcome", () => {
	const check = { date: today, status: "lighter" as const, note: "", stats, sessionId: "w-today", original: todays, undone: false };
	it("names what actually happened to today's session", () => {
		expect(simulateOutcome(null)).toBe("failed");
		expect(simulateOutcome(check)).toBe("lighter");
		expect(simulateOutcome({ ...check, status: "recovery" })).toBe("recovery");
		expect(simulateOutcome({ ...check, status: "recovery", sessionId: null, original: null })).toBe("restDay");
		expect(simulateOutcome({ ...check, status: "lighter", original: null })).toBe("unchanged");
		expect(simulateOutcome({ ...check, status: "unchanged", sessionId: null, original: null })).toBe("unchanged");
	});
});

describe("singleFlight", () => {
	it("shares one execution between concurrent calls and frees the slot afterwards", async () => {
		const fn = vi.fn(async () => { await Promise.resolve(); return Math.random(); });
		const f = singleFlight(fn);
		const [a, b] = await Promise.all([f(), f()]);
		expect(a).toBe(b);
		expect(fn).toHaveBeenCalledTimes(1);
		await f();
		expect(fn).toHaveBeenCalledTimes(2);
	});
});

describe("createGate", () => {
	const tick = () => new Promise<void>((r) => setTimeout(r, 0));
	it("runs a concurrent non-forced call once, and a forced call after a non-forced one", async () => {
		const gate = createGate();
		const job = vi.fn(async () => { await tick(); });
		await Promise.all([gate(false, job), gate(false, job)]);
		expect(job).toHaveBeenCalledTimes(1);
		const job2 = vi.fn(async () => { await tick(); });
		await Promise.all([gate(false, job2), gate(true, job2), gate(true, job2)]);
		expect(job2).toHaveBeenCalledTimes(2);
	});
});

describe("fetchPersonalPlan (onboarding plan screen)", () => {
	const input = { profile, trainerSlug: "hanna" };
	it("saves the user, registers the device and returns the AI plan with its why list", async () => {
		const deps = fakes({ requestPlan: vi.fn(async (): Promise<PlanResponse> => ({ planned: [todays], summary: "Hi", why: ["Your goal"], createdBy: "ai", trainingId: 3 })) });
		const plan = await fetchPersonalPlan(input, today, TOKEN, null, deps);
		expect(plan).toEqual({ planned: [todays], summary: "Hi", why: ["Your goal"], source: "ai", backend: { deviceId: 9 } });
		expect(deps.saveUser).toHaveBeenCalledWith(profile, "hanna", TOKEN);
		expect(deps.requestPlan).toHaveBeenCalledWith(TOKEN, { profile, trainerSlug: "hanna", wishes: [], today });
	});
	it("re-saves the user and reuses a device registered earlier in the same onboarding", async () => {
		const deps = fakes();
		const plan = await fetchPersonalPlan(input, today, TOKEN, { deviceId: 4 }, deps);
		expect(plan.backend).toEqual({ deviceId: 4 });
		expect(deps.saveUser).toHaveBeenCalledTimes(1);
		expect(deps.createDevice).not.toHaveBeenCalled();
	});
	it("falls back to the rule-based plan when the route fails, keeping the device", async () => {
		const deps = fakes({ requestPlan: vi.fn(async () => { throw new Error("down"); }) });
		const plan = await fetchPersonalPlan(input, today, TOKEN, null, deps);
		expect(plan.source).toBe("rules");
		expect(plan.backend).toEqual({ deviceId: 9 });
		expect(plan.planned.map((w) => [w.id, w.title])).toEqual(generatePlan(profile, today, 4).map((w) => [w.id, w.title]));
	});
	it("falls back to the rule-based plan when the flow is too slow", async () => {
		const deps = fakes({ requestPlan: vi.fn(() => new Promise<PlanResponse>(() => undefined)) });
		const plan = await fetchPersonalPlan(input, today, TOKEN, null, deps, 20);
		expect(plan.source).toBe("rules");
		expect(plan.why).toEqual([]);
	});
});
