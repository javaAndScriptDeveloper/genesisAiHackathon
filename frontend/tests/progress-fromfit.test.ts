import { describe, expect, it } from "vitest";
import { seedHistory } from "@/lib/fit/seed";
import type { PlannedWorkout, Profile, SessionLog } from "@/lib/fit/types";
import { historyFromFit } from "@/lib/progress/fromFit";
import { insights } from "@/lib/progress";

const profile: Profile = {
	name: "Test",
	age: 30,
	gender: null,
	heightCm: 170,
	weightKg: 70,
	goal: "stay-fit",
	experience: "beginner",
	location: "home",
	equipment: ["dumbbells"],
	durationMin: 30,
	daysPerWeek: 3,
	limitations: [],
	limitationNote: "",
	wearable: "none",
};

function planned(id: string, date: string, over: Partial<PlannedWorkout> = {}): PlannedWorkout {
	return {
		id,
		date,
		title: "T",
		focus: "f",
		durationMin: 30,
		difficulty: 2,
		exercises: [{ id: `${id}-b`, exerciseId: "goblet-squat", restSec: 60, sets: [{ target: 10, done: false }, { target: 10, done: false }, { target: 10, done: false }] }],
		status: "planned",
		...over,
	};
}

function log(over: Partial<SessionLog> = {}): SessionLog {
	return {
		id: "l1",
		plannedId: "p1",
		date: "2026-11-16",
		title: "T",
		durationSec: 1800,
		status: "completed",
		exercises: [],
		volumeKg: 0,
		perceived: "right",
		adaptations: [],
		xp: 0,
		prs: [],
		...over,
	};
}

describe("historyFromFit", () => {
	it("seed: plan and sessions map without NaN", () => {
		const seed = seedHistory(profile, "2026-11-19");
		const h = historyFromFit(seed, "2026-11-19");
		expect(h.sessions.length).toBe(seed.history.length);
		expect(h.plan.length).toBeGreaterThan(0);
		expect(h.sessions.every((s) => Number.isFinite(s.durationMin) && s.setsPlanned > 0)).toBe(true);
		expect(h.device).toBeNull();
	});

	it("skipped recovery -> rest, skipped busy -> workout (missed)", () => {
		const state = {
			planned: [
				planned("a", "2026-11-09", { status: "skipped", skipReason: "recovery" }),
				planned("b", "2026-11-10", { status: "skipped", skipReason: "busy" }),
				planned("c", "2026-11-12", { status: "completed" }),
				planned("d", "2026-11-13", { status: "planned", adHoc: true }),
			],
			history: [],
			bodyWeights: [],
		};
		const h = historyFromFit(state, "2026-11-19");
		const byDate = new Map(h.plan.map((p) => [p.date, p.type]));
		expect(byDate.get("2026-11-09")).toBe("rest");
		expect(byDate.get("2026-11-10")).toBe("workout");
		expect(byDate.get("2026-11-11")).toBe("rest");
		expect(byDate.get("2026-11-12")).toBe("workout");
		expect(h.plan[h.plan.length - 1]?.date).toBe("2026-11-12");
	});

	it("timed exercise -> durationSec, weight -> weighted, unknown id skipped", () => {
		const state = {
			planned: [planned("p1", "2026-11-16")],
			history: [
				log({
					adaptations: ["easier"],
					perceived: "hard",
					exercises: [
						{ exerciseId: "plank", skipped: false, sets: [{ reps: 45 }] },
						{ exerciseId: "goblet-squat", skipped: false, sets: [{ reps: 10, weight: 12 }, { reps: 8, weight: 12 }] },
						{ exerciseId: "bodyweight-squat", skipped: true, sets: [{ reps: 10 }] },
						{ exerciseId: "nope", skipped: false, sets: [{ reps: 10 }] },
					],
				}),
			],
			bodyWeights: [{ date: "2026-11-16", kg: 70.5 }],
		};
		const h = historyFromFit(state, "2026-11-19");
		const s = h.sessions[0];
		expect(s?.planned).toBe(true);
		expect(s?.adapted).toBe(true);
		expect(s?.rpe).toBe("hard");
		expect(s?.durationMin).toBe(30);
		expect(s?.setsPlanned).toBe(3);
		expect(s?.sets).toContainEqual({ exerciseId: "plank", reps: 0, weightKg: null, durationSec: 45 });
		expect(s?.sets).toContainEqual({ exerciseId: "goblet-squat", reps: 10, weightKg: 12, durationSec: null });
		expect(s?.sets.some((x) => x.exerciseId === "bodyweight-squat")).toBe(false);
		const kinds = Object.fromEntries(h.exercises.map((e) => [e.id, e.kind]));
		expect(kinds.plank).toBe("timed");
		expect(kinds["goblet-squat"]).toBe("weighted");
		expect(kinds.nope).toBeUndefined();
		expect(h.body).toEqual([{ date: "2026-11-16", weightKg: 70.5 }]);
	});

	it("empty state -> empty history, no insights", () => {
		const h = historyFromFit({ planned: [], history: [], bodyWeights: [] }, "2026-11-19");
		expect(h.plan).toEqual([]);
		expect(insights(h)).toEqual([]);
	});
});
