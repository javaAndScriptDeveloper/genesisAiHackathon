import { describe, expect, it } from "vitest";
import { demoHistory } from "@/lib/api/mock/progressDb";
import { personalRecords } from "@/lib/progress/records";
import {
	bestFormulaSet,
	clientToViewX,
	formulaParams,
	isLockedPeriod,
	matchesFilter,
	periodChange,
	pickExercise,
	pickPointIndex,
	plottedMetric,
	pointsInPeriod,
	pointXs,
	recordExercises,
	recordKey,
	recordRows,
} from "@/lib/progress/recordsScreen";
import type { Exercise, History, SetLog, WorkoutSession } from "@/lib/progress/types";

const exercises: Exercise[] = [
	{ id: "pushup", name: "Push-up", kind: "bodyweight" },
	{ id: "goblet", name: "Goblet squat", kind: "weighted" },
	{ id: "plank", name: "Plank", kind: "timed" },
];
const sess = (id: string, date: string, sets: SetLog[]): WorkoutSession => ({ id, date, planned: true, status: "completed", adapted: false, durationMin: 30, setsPlanned: sets.length, sets, rpe: null });
const wt = (reps: number, kg: number): SetLog => ({ exerciseId: "goblet", reps, weightKg: kg, durationSec: null });
const bw = (reps: number): SetLog => ({ exerciseId: "pushup", reps, weightKg: null, durationSec: null });
const hist = (sessions: WorkoutSession[]): History => ({ today: "2026-11-21", exercises, plan: [], sessions, body: [], checkIns: [], device: null });
const H = hist([sess("a", "2026-10-01", [wt(5, 28), bw(8)]), sess("b", "2026-11-01", [wt(5, 32), wt(12, 40), bw(10)]), sess("c", "2026-11-15", [wt(8, 26), bw(14)])]);

describe("records screen helpers", () => {
	it("filter: weighted vs bodyweight (timed counts as bodyweight)", () => {
		expect(matchesFilter("weighted", "weighted")).toBe(true);
		expect(matchesFilter("timed", "weighted")).toBe(false);
		expect(matchesFilter("timed", "bodyweight")).toBe(true);
		expect(matchesFilter("weighted", "bodyweight")).toBe(false);
		expect(matchesFilter("weighted", "all")).toBe(true);
	});

	it("recordRows: grouped by filter, newest first, flags fresh pr events only", () => {
		const records = personalRecords(H);
		const fresh = new Set([recordKey(records[records.length - 1]!)]);
		const all = recordRows(H, records, "all", fresh);
		expect(all.length).toBe(records.length);
		expect([...all.map((r) => r.date)].sort().reverse()).toEqual(all.map((r) => r.date));
		expect(all.filter((r) => r.isNew)).toHaveLength(1);
		expect(recordRows(H, records, "weighted", new Set()).every((r) => r.exerciseId === "goblet")).toBe(true);
		const bwRows = recordRows(H, records, "bodyweight", new Set());
		expect(bwRows.every((r) => r.exerciseId === "pushup")).toBe(true);
		expect(bwRows.map((r) => r.gain)).toEqual([4, 2]);
	});

	it("recordExercises: only exercises with data, most recent first; pickExercise falls back", () => {
		const opts = recordExercises(H, "all");
		expect(opts.map((o) => o.id)).toEqual(["goblet", "pushup"]);
		expect(opts.some((o) => o.id === "plank")).toBe(false);
		expect(pickExercise(opts, "pushup")).toBe("pushup");
		expect(pickExercise(recordExercises(H, "weighted"), "pushup")).toBe("goblet");
		expect(pickExercise([], "x")).toBeNull();
	});

	it("formula example: best qualifying set (not the 12-rep set) and display params", () => {
		const ex = bestFormulaSet(H, "goblet");
		expect(ex).toEqual({ weightKg: 32, reps: 5, e1rmKg: 36, date: "2026-11-01" });
		expect(formulaParams(ex!, (kg, d) => `${kg.toFixed(d)} kg`)).toEqual({ weight: "32 kg", reps: 5, e1rm: "36.0 kg" });
		expect(bestFormulaSet(H, "pushup")).toBeNull();
		expect(bestFormulaSet(hist([sess("z", "2026-11-01", [wt(12, 40)])]), "goblet")).toBeNull();
	});

	it("plottedMetric: e1rm, weight fallback, reps", () => {
		expect(plottedMetric(H, "goblet")).toBe("e1rm");
		expect(plottedMetric(hist([sess("z", "2026-11-01", [wt(12, 40)])]), "goblet")).toBe("weight");
		expect(plottedMetric(H, "pushup")).toBe("reps");
		expect(plottedMetric(H, "nope")).toBeNull();
	});

	it("periods: window filtering and premium gating", () => {
		const pts = [
			{ date: "2025-12-01", value: 1 },
			{ date: "2026-09-01", value: 2 },
			{ date: "2026-11-05", value: 3 },
			{ date: "2026-11-20", value: 4 },
		];
		expect(pointsInPeriod(pts, "2026-11-21", 28).map((p) => p.value)).toEqual([3, 4]);
		expect(pointsInPeriod(pts, "2026-11-21", 91).map((p) => p.value)).toEqual([2, 3, 4]);
		expect(pointsInPeriod(pts, "2026-11-21", 365).map((p) => p.value)).toEqual([1, 2, 3, 4]);
		expect(isLockedPeriod("4w", false)).toBe(false);
		expect(isLockedPeriod("3m", false)).toBe(false);
		expect(isLockedPeriod("year", false)).toBe(true);
		expect(isLockedPeriod("year", true)).toBe(false);
		expect(periodChange(pts)).toBe(3);
		expect(periodChange(pts.slice(0, 1))).toBe(0);
	});

	it("chart point picking for a given x", () => {
		const box = { width: 300, height: 100, padX: 10, padY: 10 };
		const xs = pointXs(["2026-11-01", "2026-11-03", "2026-11-11"], box);
		expect(xs[0]).toBe(10);
		expect(xs[2]).toBe(290);
		expect(xs[1]).toBeCloseTo(10 + 0.2 * 280, 5);
		expect(pickPointIndex(xs, 0)).toBe(0);
		expect(pickPointIndex(xs, 70)).toBe(1);
		expect(pickPointIndex(xs, 200)).toBe(2);
		expect(pickPointIndex(xs, 9999)).toBe(2);
		expect(pickPointIndex([], 5)).toBe(-1);
		expect(pointXs(["2026-11-01"], box)).toEqual([150]);
		expect(clientToViewX(150, 100, 200, 300)).toBe(75);
		expect(clientToViewX(10, 0, 0, 300)).toBe(0);
	});

	it("demo history yields records for the screen", () => {
		const h = demoHistory();
		expect(recordRows(h, personalRecords(h), "all", new Set()).length).toBeGreaterThan(0);
	});
});
