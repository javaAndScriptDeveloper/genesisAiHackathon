import { describe, expect, it } from "vitest";
import { exerciseInsight, insights } from "@/lib/progress/insights";
import { interpolate } from "@/lib/messages";
import type { Exercise, History, PlannedDay, Rpe, SetLog, WorkoutSession } from "@/lib/progress/types";

const exercises: Exercise[] = [
	{ id: "pushup", name: "Push-up", kind: "bodyweight" },
	{ id: "squat", name: "Squat", kind: "weighted" },
];
const bw = (id: string, reps: number): SetLog => ({ exerciseId: id, reps, weightKg: null, durationSec: null });
function sess(id: string, date: string, reps: number, rpe: Rpe | null = null, exId = "pushup"): WorkoutSession {
	return { id, date, planned: true, status: "completed", adapted: false, durationMin: 30, setsPlanned: 1, sets: [bw(exId, reps)], rpe };
}
const plan = (...dates: string[]): PlannedDay[] => dates.map((date) => ({ date, type: "workout" }));
const hist = (sessions: WorkoutSession[], p: PlannedDay[] = []): History => ({ today: "2026-11-21", exercises, plan: p, sessions, body: [], device: null });

// 2026-11-20 is Friday (weekday 4); 11-13 Friday too.
const fridayMissPlan = plan("2026-11-13", "2026-11-20");

describe("interpolate", () => {
	it("підставляє змінні", () => expect(interpolate("Разом {n}", { n: 3 })).toBe("Разом 3"));
	it("усі входження, невідомі лишає", () => expect(interpolate("{a} {a} {b}", { a: "x" })).toBe("x x {b}"));
});

describe("insights", () => {
	it("порожня історія — без інсайтів", () => expect(insights(hist([]))).toEqual([]));
	it("too_hard: останні 3 hard", () => {
		const h = hist([sess("a", "2026-11-01", 5, "ok"), sess("b", "2026-11-05", 5, "hard"), sess("c", "2026-11-08", 5, "hard"), sess("d", "2026-11-10", 5, "hard")]);
		expect(insights(h)).toEqual([{ id: "too_hard", vars: {} }]);
	});
	it("too_hard не спрацьовує при двох hard", () => {
		const h = hist([sess("a", "2026-11-05", 5, "ok"), sess("b", "2026-11-08", 5, "hard"), sess("c", "2026-11-10", 5, "hard")]);
		expect(insights(h).map((i) => i.id)).not.toContain("too_hard");
	});
	it("два пропуски в п'ятницю", () => {
		expect(insights(hist([], fridayMissPlan))).toContainEqual({ id: "weekday_misses", vars: { weekday: 4 } });
	});
	it("один пропуск — не інсайт", () => {
		expect(insights(hist([], plan("2026-11-20"))).map((i) => i.id)).not.toContain("weekday_misses");
	});
	it("strength_gain: віджимання 8 → 12", () => {
		const h = hist([sess("a", "2026-11-05", 8), sess("b", "2026-11-12", 10), sess("c", "2026-11-19", 12)]);
		expect(insights(h)).toContainEqual(
			expect.objectContaining({ id: "strength_gain", vars: expect.objectContaining({ exerciseId: "pushup", exercise: "Push-up", from: 8, to: 12, weeks: 2 }) }),
		);
	});
	it("пріоритет і ліміт 2", () => {
		const h = hist(
			[sess("a", "2026-11-05", 8, "hard"), sess("b", "2026-11-12", 10, "hard"), sess("c", "2026-11-19", 12, "hard")],
			fridayMissPlan,
		);
		expect(insights(h).map((i) => i.id)).toEqual(["too_hard", "weekday_misses"]);
		expect(insights(h, 3).map((i) => i.id)).toEqual(["too_hard", "weekday_misses", "strength_gain"]);
	});
});

describe("exerciseInsight", () => {
	const h = hist([sess("a", "2026-11-05", 8), sess("b", "2026-11-19", 12)]);
	it("приріст для вправи", () => expect(exerciseInsight(h, "pushup")?.vars).toMatchObject({ from: 8, to: 12, weeks: 2 }));
	it("немає приросту — null", () => {
		expect(exerciseInsight(hist([sess("a", "2026-11-05", 12), sess("b", "2026-11-19", 8)]), "pushup")).toBeNull();
		expect(exerciseInsight(h, "squat")).toBeNull();
	});
});
