import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/plan/route";
import { exerciseCatalog, parseAiPlan, planFromAi, type AiPlan } from "@/lib/fit/aiPlan";
import { toISO } from "@/lib/fit/dates";
import { getExercise } from "@/lib/fit/exercises";
import { emptyState } from "@/lib/fit/seed";
import { reducer } from "@/lib/fit/store/reducer";
import type { Profile } from "@/lib/fit/types";

const profile: Profile = {
	name: "Alex", age: 30, gender: null, heightCm: 178, weightKg: 80, goal: "build-muscle", experience: "intermediate",
	location: "home", equipment: ["dumbbells"], durationMin: 45, daysPerWeek: 3, limitations: ["knees"], limitationNote: "", wearable: "none",
};
const today = toISO(new Date());

const template: AiPlan = {
	summary: "Alex, three sessions a week.",
	why: ["Built for muscle"],
	sessions: [
		{ title: "Upper", exercises: [{ id: "db-row", sets: 4, reps: 10, restSec: 75 }, { id: "db-shoulder-press", sets: 3, reps: 10, restSec: 75 }, { id: "made-up", sets: 3, reps: 10, restSec: 60 }] },
		{ title: "Lower", exercises: [{ id: "db-rdl", sets: 4, reps: 10, restSec: 90 }, { id: "glute-bridge", sets: 3, reps: 12, restSec: 60 }] },
		// Knee-stressing only: unusable for this profile, so this day falls back to the rule-based workout.
		{ title: "Knees", exercises: [{ id: "goblet-squat", sets: 3, reps: 10, restSec: 60 }, { id: "reverse-lunge", sets: 3, reps: 10, restSec: 60 }] },
	],
};

describe("parseAiPlan", () => {
	it("accepts fenced JSON and clamps the dose", () => {
		const plan = parseAiPlan('```json\n{"summary":"x","why":[],"sessions":[{"title":"A","exercises":[{"id":"db-row","sets":20,"reps":0,"restSec":999}]}]}\n```');
		expect(plan?.sessions[0]?.exercises[0]).toEqual({ id: "db-row", sets: 6, reps: 1, restSec: 240 });
	});
	it("rejects junk", () => {
		expect(parseAiPlan("nope")).toBeNull();
		expect(parseAiPlan('{"sessions":[]}')).toBeNull();
	});
});

describe("planFromAi", () => {
	const planned = planFromAi(template, profile, today, 2);
	it("only contains exercises the user can do", () => {
		const usable = new Set(exerciseCatalog(profile).map((e) => e.id));
		for (const w of planned) for (const b of w.exercises) expect(usable.has(b.exerciseId)).toBe(true);
	});
	it("uses the AI dose and our loads", () => {
		const upper = planned.find((w) => w.title === "Upper");
		const row = upper?.exercises.find((b) => b.exerciseId === "db-row");
		expect(row?.sets).toHaveLength(4);
		expect(row?.sets[0]?.target).toBe(10);
		expect(row?.sets[0]?.targetWeight).toBeGreaterThan(0);
		expect(getExercise("db-row").loadFactor).toBeDefined();
	});
	it("falls back to the rule-based workout for an unusable session", () => {
		expect(planned.some((w) => w.title === "Knees")).toBe(false);
		expect(planned.every((w) => w.exercises.length >= 2)).toBe(true);
	});
});

describe("complete-onboarding with a prebuilt plan", () => {
	it("stores the given plan", () => {
		const planned = planFromAi(template, profile, today, 4);
		const s = reducer(emptyState(), { type: "complete-onboarding", profile, units: "metric", demoHistory: false, today, now: new Date().toISOString(), planned });
		expect(s.planned).toEqual(planned);
	});
	it("keeps demo history in the past and the given plan from today", () => {
		const planned = planFromAi(template, profile, today, 4);
		const s = reducer(emptyState(), { type: "complete-onboarding", profile, units: "metric", demoHistory: true, today, now: new Date().toISOString(), planned });
		expect(s.planned.filter((w) => w.date >= today)).toEqual(planned);
		expect(s.history.length).toBeGreaterThan(0);
	});
});

describe("POST /api/plan", () => {
	const saved = process.env.GEMINI_API_KEY;
	afterEach(() => {
		process.env.GEMINI_API_KEY = saved;
	});
	const req = (body: unknown) => new Request("http://x/api/plan", { method: "POST", body: JSON.stringify(body) });
	it("rejects an invalid body", async () => {
		expect((await POST(req({ profile: { age: 3 } }))).status).toBe(400);
	});
	it("returns 503 without a key", async () => {
		delete process.env.GEMINI_API_KEY;
		expect((await POST(req({ profile }))).status).toBe(503);
	});
});
