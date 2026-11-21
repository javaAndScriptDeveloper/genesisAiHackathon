import { describe, expect, it, vi } from "vitest";
import type { AiDeps } from "@/lib/fit/aiClient";
import { dailyCheck, ensureBackend, rebuildPlan } from "@/lib/fit/aiFlow";
import type { DailyResponse, PlanResponse } from "@/lib/fit/aiApi";
import { toISO } from "@/lib/fit/dates";
import { generatePlan } from "@/lib/fit/plan";
import { emptyState } from "@/lib/fit/seed";
import { reducer } from "@/lib/fit/store/reducer";
import type { DailyStats } from "@/lib/fit/dailyStats";
import type { FitState, PlannedWorkout, Profile } from "@/lib/fit/types";

const profile: Profile = {
	name: "Alex", age: 30, gender: null, heightCm: 178, weightKg: 80, goal: "build-muscle", experience: "intermediate",
	location: "home", equipment: ["dumbbells", "bench"], durationMin: 45, daysPerWeek: 3, limitations: [], limitationNote: "", wearable: "apple",
};
const today = toISO(new Date());
const future = (n: number) => toISO(new Date(Date.now() + n * 86_400_000));
const stats: DailyStats = { date: today, sleepHours: 5, restingHr: 70, hrv: 40, steps: 1000, readiness: 30 } as unknown as DailyStats;

const base = generatePlan(profile, today, 4)[0] as PlannedWorkout;
const todays: PlannedWorkout = { ...base, id: "w-today", date: today, status: "planned", adHoc: false };
const later: PlannedWorkout = { ...base, id: "w-later", date: future(2), status: "planned" };
const done: PlannedWorkout = { ...base, id: "w-done", date: future(3), status: "completed" };

function fakes(over: Partial<AiDeps> = {}): AiDeps {
	return {
		createUser: vi.fn(async () => 7),
		patchUser: vi.fn(async () => undefined),
		createDevice: vi.fn(async () => 9),
		syncDevice: vi.fn(async () => stats),
		requestPlan: vi.fn(async (): Promise<PlanResponse> => ({ planned: [todays], summary: "s", createdBy: "ai", trainingId: 1 })),
		requestDaily: vi.fn(async (): Promise<DailyResponse> => ({ status: "unchanged", session: null, note: "ok", stats, createdBy: "ai" })),
		requestCoach: vi.fn(),
		...over,
	};
}
const ctx = { profile, trainerSlug: "john", today };

describe("ensureBackend", () => {
	it("reuses existing ids", async () => {
		const deps = fakes();
		expect(await ensureBackend(deps, { ...ctx, backend: { userId: 1, deviceId: 2 } })).toEqual({ userId: 1, deviceId: 2 });
		expect(deps.createUser).not.toHaveBeenCalled();
		expect(deps.syncDevice).not.toHaveBeenCalled();
	});
	it("creates user, device and syncs when missing", async () => {
		const deps = fakes();
		expect(await ensureBackend(deps, { ...ctx, backend: null })).toEqual({ userId: 7, deviceId: 9 });
		expect(deps.createDevice).toHaveBeenCalledWith(7, "Apple Watch");
		expect(deps.syncDevice).toHaveBeenCalledWith(7, 9, today);
	});
	it("returns null when createUser rejects", async () => {
		const deps = fakes({ createUser: vi.fn(async () => { throw new Error("down"); }) });
		expect(await ensureBackend(deps, { ...ctx, backend: null })).toBeNull();
	});
});

describe("rebuildPlan", () => {
	it("returns null when the request fails", async () => {
		const deps = fakes({ requestPlan: vi.fn(async () => { throw new Error("x"); }) });
		expect(await rebuildPlan(deps, { ...ctx, backend: null, wishes: [] })).toBeNull();
	});
	it("sends the user id", async () => {
		const deps = fakes();
		await rebuildPlan(deps, { ...ctx, backend: { userId: 3, deviceId: 4 }, wishes: ["a"] });
		expect(deps.requestPlan).toHaveBeenCalledWith({ userId: 3, profile, trainerSlug: "john", wishes: ["a"], today });
	});
});

describe("dailyCheck", () => {
	const s = { ...ctx, backend: { userId: 1, deviceId: 2 }, planned: [todays, later, done], wishes: [] as string[], daily: null };
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
		expect(deps.syncDevice).toHaveBeenCalledWith(1, 2, today, "tired");
		expect(deps.requestDaily).toHaveBeenCalledWith({ userId: 1, profile, trainerSlug: "john", session: todays, upcoming: [later], wishes: [], today });
	});
	it("after rebuild on a bad day the forced check runs again and replaces today", async () => {
		const recovery: PlannedWorkout = { ...todays, title: "Recovery", durationMin: 15 };
		let state: FitState = { ...emptyState(), profile, planned: [todays, later], daily: { date: today, status: "unchanged", note: "", stats: null, sessionId: "w-today", original: null, undone: false } };
		state = reducer(state, { type: "apply-ai-plan", planned: [todays, later], summary: "s", source: "ai", wishes: [], today });
		expect(state.daily).toBeNull();
		const deps = fakes({ requestDaily: vi.fn(async (): Promise<DailyResponse> => ({ status: "recovery", session: recovery, note: "rest", stats, createdBy: "ai" })) });
		const result = await dailyCheck(deps, { ...ctx, backend: { userId: 1, deviceId: 2 }, planned: state.planned, wishes: [], daily: state.daily, force: true });
		expect(deps.requestDaily).toHaveBeenCalledTimes(1);
		if (!result) throw new Error("expected result");
		state = reducer(state, { type: "apply-daily", ...result });
		expect(state.planned.find((w) => w.date === today)?.title).toBe("Recovery");
		expect(state.daily?.status).toBe("recovery");
	});
});
