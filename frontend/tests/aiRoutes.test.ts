import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiWeek } from "@/lib/fit/aiPlan";
import { plannedWorkoutSchema, type CoachResponse, type DailyResponse, type PlanResponse } from "@/lib/fit/aiApi";
import { buildPlanFromAi } from "@/lib/fit/aiPlan";
import { generatePlan } from "@/lib/fit/plan";
import type { DailyStats } from "@/lib/fit/dailyStats";
import type { Profile } from "@/lib/fit/types";

vi.mock("@/lib/ai/planner", () => ({ generateWeek: vi.fn(), adjustSession: vi.fn(), coachChat: vi.fn() }));
vi.mock("@/lib/api/platform", () => ({ getSnapshots: vi.fn(), saveTraining: vi.fn(), getTrainerTov: vi.fn() }));

import { POST } from "@/app/api/plan/route";
import { POST as DAILY } from "@/app/api/plan/daily/route";
import { POST as COACH } from "@/app/api/coach/route";
import { AiConfigError } from "@/lib/ai/errors";
import { adjustSession, coachChat, generateWeek } from "@/lib/ai/planner";
import { safetyReplyText } from "@/lib/fit/coach";
import { getSnapshots, getTrainerTov, saveTraining } from "@/lib/api/platform";

const profile: Profile = {
	name: "Ann",
	age: 30,
	gender: null,
	heightCm: 170,
	weightKg: 60,
	goal: "stay-fit",
	goalText: "feel stronger",
	experience: "beginner",
	location: "home",
	equipment: ["bands"],
	durationMin: 30,
	daysPerWeek: 3,
	limitations: [],
	limitationNote: "",
	wearable: "none",
};
const today = "2026-11-23";
const req = (body: unknown) => new Request("http://x/api/plan", { method: "POST", body: JSON.stringify(body) });
const base = { userId: 7, profile, trainerSlug: "john", wishes: ["more legs"], today };

const goodWeek: AiWeek = {
	summary: "AI summary",
	sessions: [1, 3, 5].map((weekday) => ({ weekday, title: "Day", focus: "Full body", exercises: [{ exerciseId: "squat", sets: 3, reps: 10, restSec: 60 }] })),
};

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(getSnapshots).mockResolvedValue([]);
	vi.mocked(getTrainerTov).mockResolvedValue({ name: "John", tov: "calm" });
	vi.mocked(saveTraining).mockResolvedValue(42);
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/plan", () => {
	it("returns the AI plan and saves it as weekly", async () => {
		const { EXERCISES, isUsable } = await import("@/lib/fit/exercises");
		const ids = EXERCISES.filter((e) => isUsable(e, profile)).slice(0, 2).map((e) => e.id);
		expect(ids).toHaveLength(2);
		const exercises = ids.map((exerciseId) => ({ exerciseId, sets: 3, reps: 10, restSec: 60 }));
		vi.mocked(generateWeek).mockResolvedValue({ ...goodWeek, sessions: goodWeek.sessions.map((s) => ({ ...s, exercises })) });
		const res = await POST(req(base));
		const json: PlanResponse = await res.json();
		expect(res.status).toBe(200);
		expect(json.createdBy).toBe("ai");
		expect(json.summary).toBe("AI summary");
		expect(json.trainingId).toBe(42);
		expect(saveTraining).toHaveBeenCalledTimes(1);
		const call = vi.mocked(saveTraining).mock.calls[0];
		expect(call?.[0]).toBe(7);
		expect(call?.[2].kind).toBe("weekly");
		expect(call?.[2].inputs.wishes).toEqual(["more legs"]);
	});

	it("falls back when Gemini throws", async () => {
		vi.mocked(generateWeek).mockRejectedValue(new Error("boom"));
		const res = await POST(req(base));
		const json: PlanResponse = await res.json();
		expect(res.status).toBe(200);
		expect(json.createdBy).toBe("fallback");
		expect(json.summary).toContain("John here");
		expect(json.planned.length).toBe(profile.daysPerWeek * 4);
		expect(vi.mocked(saveTraining).mock.calls[0]?.[2].kind).toBe("fallback");
	});

	it("falls back when the AI returns only invalid ids", async () => {
		vi.mocked(generateWeek).mockResolvedValue({ summary: "s", sessions: [{ weekday: 1, title: "x", focus: "y", exercises: [{ exerciseId: "nope", sets: 3, reps: 10, restSec: 60 }] }] });
		const json: PlanResponse = await (await POST(req(base))).json();
		expect(json.createdBy).toBe("fallback");
		expect(json.planned.length).toBe(profile.daysPerWeek * 4);
	});

	it("skips the backend for anonymous users", async () => {
		vi.mocked(generateWeek).mockRejectedValue(new Error("boom"));
		const json: PlanResponse = await (await POST(req({ ...base, userId: null }))).json();
		expect(json.trainingId).toBeNull();
		expect(getSnapshots).not.toHaveBeenCalled();
		expect(saveTraining).not.toHaveBeenCalled();
	});

	it("rejects an invalid body with 400", async () => {
		expect((await POST(req({ ...base, today: "tomorrow" }))).status).toBe(400);
		expect((await POST(req({ ...base, wishes: Array(11).fill("x") }))).status).toBe(400);
		expect((await POST(new Request("http://x/api/plan", { method: "POST", body: "nope" }))).status).toBe(400);
	});
});

describe("POST /api/plan/daily", () => {
	const upcoming = generatePlan(profile, today, 4);
	const session = upcoming[0]!;
	const stats = (readiness: number): DailyStats => ({ date: today, sleepHours: 6, sleepScore: 60, restingHr: 60, hrvMs: 50, steps: 3000, activeKcal: 200, readiness, source: "demo", scenario: "tired" });
	const dreq = (body: unknown) => new Request("http://x/api/plan/daily", { method: "POST", body: JSON.stringify(body) });
	const dbase = { userId: 7, profile, trainerSlug: "john", session, upcoming, wishes: [], today };
	const run = async (body: unknown): Promise<{ status: number; json: DailyResponse }> => {
		const res = await DAILY(dreq(body));
		return { status: res.status, json: await res.json() };
	};

	it("recovery: shortens the session keeping its id and saves a daily-adjust", async () => {
		vi.mocked(getSnapshots).mockResolvedValue([stats(30)]);
		vi.mocked(adjustSession).mockRejectedValue(new Error("boom"));
		const { status, json } = await run(dbase);
		expect(status).toBe(200);
		expect(json.status).toBe("recovery");
		expect(json.createdBy).toBe("fallback");
		expect(json.session?.id).toBe(session.id);
		expect(json.session?.durationMin).toBeLessThanOrEqual(30);
		const call = vi.mocked(saveTraining).mock.calls[0];
		expect(call?.[2].kind).toBe("daily-adjust");
		expect(call?.[2].planned).toHaveLength(upcoming.length);
		expect(call?.[2].inputs.stats).toEqual([stats(30)]);
	});

	it("lighter: falls back when the AI adds more sets than the original", async () => {
		vi.mocked(getSnapshots).mockResolvedValue([stats(50)]);
		const exercises = (session.exercises.length ? session.exercises : []).map((b) => ({ exerciseId: b.exerciseId, sets: b.sets.length + 3, reps: 10, restSec: 60 }));
		vi.mocked(adjustSession).mockResolvedValue({ note: "Go hard!", title: "Hard", exercises });
		const { json } = await run(dbase);
		expect(json.status).toBe("lighter");
		expect(json.createdBy).toBe("fallback");
		expect(json.note).not.toBe("Go hard!");
		const total = (w: { exercises: { sets: unknown[] }[] }) => w.exercises.reduce((n, b) => n + b.sets.length, 0);
		expect(total(json.session!)).toBeLessThanOrEqual(total(session));
	});

	it("unchanged: returns only a note and saves nothing", async () => {
		vi.mocked(getSnapshots).mockResolvedValue([stats(80)]);
		vi.mocked(adjustSession).mockResolvedValue({ note: "Great shape", title: "t", exercises: [] });
		const { status, json } = await run(dbase);
		expect(status).toBe(200);
		expect(json.status).toBe("unchanged");
		expect(json.session).toBeNull();
		expect(json.note).toBe("Great shape");
		expect(json.createdBy).toBe("ai");
		expect(saveTraining).not.toHaveBeenCalled();
	});

	it("unchanged: uses the fine note when the AI throws", async () => {
		vi.mocked(getSnapshots).mockResolvedValue([stats(80)]);
		vi.mocked(adjustSession).mockRejectedValue(new Error("boom"));
		const { json } = await run(dbase);
		expect(json.createdBy).toBe("fallback");
		expect(json.note.length).toBeGreaterThan(0);
	});

	it("no snapshot for today: unchanged, no stats, AI not called", async () => {
		vi.mocked(getSnapshots).mockResolvedValue([{ ...stats(20), date: "2026-11-20" }]);
		const { json } = await run(dbase);
		expect(json.stats).toBeNull();
		expect(json.status).toBe("unchanged");
		expect(json.session).toBeNull();
		expect(adjustSession).not.toHaveBeenCalled();
		expect(saveTraining).not.toHaveBeenCalled();
	});

	it("rejects an invalid body with 400", async () => {
		expect((await DAILY(dreq({ ...dbase, today: "x" }))).status).toBe(400);
		expect((await DAILY(new Request("http://x/api/plan/daily", { method: "POST", body: "nope" }))).status).toBe(400);
	});
});

describe("POST /api/coach", () => {
	const creq = (body: unknown) => new Request("http://x/api/coach", { method: "POST", body: JSON.stringify(body) });
	const cbase = { userId: 7, profile, trainerSlug: "john", wishes: [], planSummary: "plan", messages: [{ from: "user", text: "make it shorter" }] };
	const run = async (body: unknown): Promise<{ status: number; json: CoachResponse & { error?: string } }> => {
		const res = await COACH(creq(body));
		return { status: res.status, json: await res.json() };
	};

	it("answers symptoms with the safety reply and never calls Gemini", async () => {
		const { status, json } = await run({ ...cbase, messages: [{ from: "user", text: "I have chest pain" }] });
		expect(status).toBe(200);
		expect(json.safety).toBe(true);
		expect(json.rebuild).toBeNull();
		expect(json.reply).toBe(safetyReplyText());
		expect(coachChat).not.toHaveBeenCalled();
	});

	it("passes the AI reply and rebuild through", async () => {
		const rebuild = { wishes: ["shorter"], profileChanges: { durationMin: 20 }, summary: "Shorter plan" };
		vi.mocked(coachChat).mockResolvedValue({ reply: "Sure thing", rebuild });
		const { status, json } = await run(cbase);
		expect(status).toBe(200);
		expect(json).toEqual({ reply: "Sure thing", rebuild, safety: false });
	});

	it("returns 503 when Gemini fails", async () => {
		vi.mocked(coachChat).mockRejectedValue(new Error("daysPerWeek 9 invalid"));
		const { status, json } = await run(cbase);
		expect(status).toBe(503);
		expect(json.error).toBe("Coach unavailable");
	});

	it("returns 503 when the key is missing", async () => {
		vi.mocked(coachChat).mockRejectedValue(new AiConfigError("GEMINI_API_KEY"));
		expect((await run(cbase)).status).toBe(503);
	});

	it("rejects an invalid body with 400", async () => {
		expect((await COACH(creq({ ...cbase, messages: [] }))).status).toBe(400);
		expect((await COACH(creq({ ...cbase, messages: [{ from: "coach", text: "hi" }] }))).status).toBe(400);
		expect((await COACH(creq({ ...cbase, messages: [{ from: "user", text: "x".repeat(601) }] }))).status).toBe(400);
		expect((await COACH(new Request("http://x/api/coach", { method: "POST", body: "nope" }))).status).toBe(400);
	});
});

describe("planned workout schema round trip", () => {
	it("accepts generatePlan and buildPlanFromAi output", async () => {
		const { EXERCISES, isUsable } = await import("@/lib/fit/exercises");
		const ids = EXERCISES.filter((e) => isUsable(e, profile)).slice(0, 2).map((e) => e.id);
		const exercises = ids.map((exerciseId) => ({ exerciseId, sets: 3, reps: 10, restSec: 60 }));
		const built = buildPlanFromAi({ ...goodWeek, sessions: goodWeek.sessions.map((s) => ({ ...s, exercises })) }, profile, today, 4);
		expect(built.valid).toBe(true);
		for (const w of [...generatePlan(profile, today, 4), ...built.planned]) expect(plannedWorkoutSchema.safeParse(w).success).toBe(true);
	});
});
