import { describe, expect, it } from "vitest";
import { estimate1RM, exerciseSeries, mainMetric, personalRecords, setRecords } from "@/lib/progress/records";
import type { Exercise, History, SetLog, WorkoutSession } from "@/lib/progress/types";

const exercises: Exercise[] = [
	{ id: "pushup", name: "Push-up", kind: "bodyweight" },
	{ id: "goblet_squat", name: "Goblet squat", kind: "weighted" },
	{ id: "squat", name: "Squat", kind: "weighted" },
	{ id: "plank", name: "Plank", kind: "timed" },
];

function sess(id: string, date: string, sets: SetLog[], status: WorkoutSession["status"] = "completed"): WorkoutSession {
	return { id, date, planned: true, status, adapted: false, durationMin: 30, setsPlanned: sets.length, sets, rpe: null };
}
const bw = (reps: number): SetLog => ({ exerciseId: "pushup", reps, weightKg: null, durationSec: null });
const wt = (exerciseId: string, reps: number, weightKg: number): SetLog => ({ exerciseId, reps, weightKg, durationSec: null });
const hist = (sessions: WorkoutSession[]): History => ({ today: "2026-11-21", exercises, plan: [], sessions, body: [], device: null });

describe("records", () => {
	it("Brzycki з округленням до 0.1", () => {
		expect(estimate1RM(32, 5)).toBe(36);
		expect(estimate1RM(24, 7)).toBe(28.8);
		expect(estimate1RM(20, 8)).toBe(24.8);
		expect(estimate1RM(20, 11)).toBeNull();
		expect(estimate1RM(20, 12)).toBeNull();
		expect(estimate1RM(20, 0)).toBeNull();
	});
	it("перша сесія — база, не рекорд", () => {
		expect(personalRecords(hist([sess("a", "2026-11-10", [bw(8)])]))).toEqual([]);
	});
	it("ріст повторів у віджиманнях — рекорд reps", () => {
		const h = hist([sess("a", "2026-11-10", [bw(8)]), sess("b", "2026-11-12", [bw(12)])]);
		expect(personalRecords(h)).toEqual([
			expect.objectContaining({ exerciseId: "pushup", metric: "reps", value: 12, previous: 8, date: "2026-11-12", sessionId: "b" }),
		]);
	});
	it("тільки власна вага: без NaN і null у ряді", () => {
		const s = exerciseSeries(hist([sess("a", "2026-11-10", [bw(8)]), sess("b", "2026-11-12", [bw(9)])]), "pushup");
		expect(s).toHaveLength(2);
		expect(s.every((p) => Number.isFinite(p.value))).toBe(true);
	});
	it("weighted з усіма підходами > 10 повторів — ряд за вагою", () => {
		const h = hist([
			sess("a", "2026-11-10", [wt("goblet_squat", 12, 16), wt("goblet_squat", 15, 14)]),
			sess("b", "2026-11-12", [wt("goblet_squat", 12, 18)]),
		]);
		expect(exerciseSeries(h, "goblet_squat").map((p) => p.value)).toEqual([16, 18]);
	});
	it("weighted: one metric per exercise (no mixed e1rm/weight)", () => {
		const h = hist([sess("a", "2026-11-10", [wt("squat", 10, 10)]), sess("b", "2026-11-12", [wt("squat", 12, 12)])]);
		// e1RM metric is used for all; the 12-rep session has no qualifying set and is skipped
		expect(exerciseSeries(h, "squat").map((p) => p.value)).toEqual([13.3]);
	});
	it("покинуті сесії не дають рекордів", () => {
		const h = hist([sess("a", "2026-11-10", [bw(8)]), sess("b", "2026-11-12", [bw(20)], "abandoned")]);
		expect(personalRecords(h)).toEqual([]);
		expect(exerciseSeries(h, "pushup")).toHaveLength(1);
	});
	it("порядок вхідних сесій не важливий; weighted дає weight і e1rm", () => {
		const h = hist([sess("b", "2026-11-12", [wt("squat", 5, 50)]), sess("a", "2026-11-10", [wt("squat", 5, 40)])]);
		const r = personalRecords(h);
		expect(r.map((x) => x.metric).sort()).toEqual(["e1rm", "weight"]);
		expect(r.find((x) => x.metric === "weight")).toMatchObject({ value: 50, previous: 40 });
	});
	it("timed і mainMetric", () => {
		const t = (d: number): SetLog => ({ exerciseId: "plank", reps: 1, weightKg: null, durationSec: d });
		const h = hist([sess("a", "2026-11-10", [t(30)]), sess("b", "2026-11-12", [t(45)])]);
		expect(personalRecords(h)).toEqual([expect.objectContaining({ metric: "time", value: 45, previous: 30 })]);
		expect(mainMetric("weighted")).toBe("e1rm");
		expect(mainMetric("bodyweight")).toBe("reps");
		expect(mainMetric("timed")).toBe("time");
	});

	it("setRecords: найбільша вага для рівно 5/8/10 з датою першого досягнення", () => {
		const h = hist([
			sess("a", "2026-11-10", [wt("squat", 5, 40), wt("squat", 8, 30), wt("squat", 6, 99)]),
			sess("b", "2026-11-12", [wt("squat", 5, 50), wt("squat", 8, 30)]),
			sess("c", "2026-11-14", [wt("squat", 5, 50), wt("squat", 10, 20)]),
			sess("d", "2026-11-15", [wt("squat", 5, 80)], "abandoned"),
		]);
		expect(setRecords(h, "squat")).toEqual([
			{ reps: 5, weightKg: 50, date: "2026-11-12" },
			{ reps: 8, weightKg: 30, date: "2026-11-10" },
			{ reps: 10, weightKg: 20, date: "2026-11-14" },
		]);
		expect(setRecords(hist([sess("a", "2026-11-10", [wt("squat", 5, 40)])]), "squat")).toEqual([{ reps: 5, weightKg: 40, date: "2026-11-10" }]);
		expect(setRecords(h, "plank")).toEqual([]);
	});
	it("підхід 20 × 12 іде в reps-серію, не в e1RM", () => {
		const h = hist([sess("a", "2026-11-10", [wt("squat", 12, 20)]), sess("b", "2026-11-12", [wt("squat", 12, 20)])]);
		expect(exerciseSeries(h, "squat").map((p) => p.value)).toEqual([20, 20]);
		expect(personalRecords(h).filter((r) => r.metric === "e1rm")).toEqual([]);
		const bwh = hist([sess("a", "2026-11-10", [{ exerciseId: "pushup", reps: 12, weightKg: 20, durationSec: null }])]);
		expect(exerciseSeries(bwh, "pushup").map((p) => p.value)).toEqual([12]);
	});
});
