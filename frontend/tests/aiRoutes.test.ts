import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiWeek } from "@/lib/fit/aiPlan";
import type { PlanResponse } from "@/lib/fit/aiApi";
import type { Profile } from "@/lib/fit/types";

vi.mock("@/lib/ai/planner", () => ({ generateWeek: vi.fn() }));
vi.mock("@/lib/api/platform", () => ({ getSnapshots: vi.fn(), saveTraining: vi.fn(), getTrainerTov: vi.fn() }));

import { POST } from "@/app/api/plan/route";
import { generateWeek } from "@/lib/ai/planner";
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
