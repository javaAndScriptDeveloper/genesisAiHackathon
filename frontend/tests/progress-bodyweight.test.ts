import { describe, expect, it } from "vitest";
import { bmi, movingAverage, weightSummary } from "@/lib/progress/bodyWeight";

describe("bmi", () => {
	it("computes 70kg/175cm", () => {
		expect(bmi(70, 175)).toEqual({ value: 22.9, category: "normal" });
	});
	it("boundaries", () => {
		expect(bmi(56.6, 175)?.category).toBe("under"); // 18.48
		expect(bmi(56.7, 175)?.category).toBe("normal"); // 18.51
		expect(bmi(76.5, 175)?.category).toBe("normal"); // 24.98
		expect(bmi(76.6, 175)?.category).toBe("over"); // 25.01
		expect(bmi(100, 200)?.category).toBe("over"); // 25
		expect(bmi(120, 200)?.category).toBe("obese"); // 30
		expect(bmi(119.9, 200)?.category).toBe("over");
		expect(bmi(70, 175)?.category).toBe("normal");
	});
	it("uses unrounded value for category", () => {
		// 24.96 rounds to 25.0 but is still normal
		expect(bmi(76.44, 175)).toEqual({ value: 25, category: "normal" });
	});
	it("invalid input -> null", () => {
		expect(bmi(0, 175)).toBeNull();
		expect(bmi(70, 0)).toBeNull();
		expect(bmi(-1, 175)).toBeNull();
	});
});

describe("movingAverage", () => {
	it("averages measurements within 7 calendar days, gaps not zero", () => {
		const r = movingAverage(
			[
				{ date: "2026-01-10", weightKg: 80 },
				{ date: "2026-01-12", weightKg: 79 },
				{ date: "2026-01-17", weightKg: 78 },
			],
			7,
		);
		expect(r).toEqual([
			{ date: "2026-01-10", avg: 80 },
			{ date: "2026-01-12", avg: 79.5 },
			{ date: "2026-01-17", avg: 78.5 }, // 10th is out (window 11..17)
		]);
	});
	it("multiple per day, unsorted input", () => {
		const r = movingAverage(
			[
				{ date: "2026-01-02", weightKg: 70 },
				{ date: "2026-01-01", weightKg: 71 },
				{ date: "2026-01-01", weightKg: 72 },
			],
			7,
		);
		expect(r.map((x) => x.date)).toEqual(["2026-01-01", "2026-01-02"]);
		expect(r[1]?.avg).toBe(71);
	});
	it("empty", () => expect(movingAverage([], 7)).toEqual([]));
});

describe("weightSummary", () => {
	const e = [
		{ date: "2025-12-01", weightKg: 90 },
		{ date: "2026-01-05", weightKg: 85 },
		{ date: "2026-01-30", weightKg: 83.4 },
	];
	it("month window = 30 days inclusive", () => {
		const s = weightSummary(e, "month", "2026-01-30");
		expect(s.points).toHaveLength(2);
		expect(s.start).toBe(85);
		expect(s.current).toBe(83.4);
		expect(s.change).toBe(-1.6);
		expect(s.avg).toHaveLength(2);
	});
	it("window start edge", () => {
		// today 2026-01-30 -> window starts 2026-01-01
		const s = weightSummary([{ date: "2026-01-01", weightKg: 80 }, { date: "2025-12-31", weightKg: 81 }], "month", "2026-01-30");
		expect(s.points).toHaveLength(1);
	});
	it("3m and year include more", () => {
		expect(weightSummary(e, "3m", "2026-01-30").points).toHaveLength(3);
		expect(weightSummary(e, "year", "2026-01-30").change).toBe(-6.6);
	});
	it("empty -> nulls", () => {
		expect(weightSummary([], "month", "2026-01-30")).toEqual({ start: null, current: null, change: null, points: [], avg: [] });
	});
});
