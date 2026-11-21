import { describe, expect, it } from "vitest";
import { BMI_SEGMENTS, bmiMarker, buildWeightSeries, nearestDot, weightScreenView } from "@/lib/progress/weightScreen";
import type { BodyMeasurement } from "@/lib/progress/types";

const today = "2026-11-20";
const e = (date: string, weightKg: number): BodyMeasurement => ({ date, weightKg });
const entries = [e("2026-08-01", 80), e("2026-10-25", 78), e("2026-11-10", 77), e("2026-11-18", 76)];

describe("buildWeightSeries", () => {
	it("returns null with no weigh-ins in the period", () => {
		expect(buildWeightSeries([], "month", today, true)).toBeNull();
		expect(buildWeightSeries([e("2026-08-01", 80)], "month", today, true)).toBeNull();
	});
	it("keeps only the period and builds a 7-day average line", () => {
		const s = buildWeightSeries(entries, "month", today, true);
		expect(s?.dots.map((d) => d.date)).toEqual(["2026-10-25", "2026-11-10", "2026-11-18"]);
		expect(s?.line).toHaveLength(3);
		expect(s?.from).toBe("2026-10-22");
		expect(s!.min).toBeLessThan(76);
		expect(s!.max).toBeGreaterThan(78);
	});
	it("free users never see history older than 3 months, premium does", () => {
		const free = buildWeightSeries(entries, "year", today, false);
		expect(free?.dots.map((d) => d.date)).not.toContain("2026-08-01");
		expect(buildWeightSeries(entries, "year", today, true)?.dots.map((d) => d.date)).toContain("2026-08-01");
	});
	it("includes the goal in the y-domain", () => {
		const s = buildWeightSeries(entries, "month", today, true, 70);
		expect(s!.min).toBeLessThan(70);
	});
});

describe("nearestDot", () => {
	it("picks the closest weigh-in to a chart fraction", () => {
		const s = buildWeightSeries(entries, "month", today, true)!;
		expect(nearestDot(s, 0)?.date).toBe("2026-10-25");
		expect(nearestDot(s, 1)?.date).toBe("2026-11-18");
		expect(nearestDot(s, 0.55)?.date).toBe("2026-11-10");
	});
});

describe("bmiMarker", () => {
	it("is clamped and monotonic across the four segments", () => {
		expect(bmiMarker(10)).toBe(0);
		expect(bmiMarker(60)).toBe(1);
		expect(bmiMarker(18.5)).toBeCloseTo(0.25);
		expect(bmiMarker(25)).toBeCloseTo(0.5);
		expect(bmiMarker(30)).toBeCloseTo(0.75);
		expect(bmiMarker(21.75)).toBeCloseTo(0.375);
		expect(BMI_SEGMENTS).toHaveLength(4);
	});
});

describe("weightScreenView", () => {
	it("S0: no weigh-ins is an empty state without BMI", () => {
		const v = weightScreenView([], 175, "month", today, false);
		expect(v.state).toBe("empty");
		expect(v.series).toBeNull();
		expect(v.bmi).toBeNull();
	});
	it("one weigh-in is a single state, BMI shows when height is known", () => {
		const v = weightScreenView([e("2026-11-18", 76)], 175, "month", today, false);
		expect(v.state).toBe("single");
		expect(v.bmi?.category).toBe("normal");
	});
	it("hides BMI without height", () => {
		expect(weightScreenView(entries, 0, "month", today, true).bmi).toBeNull();
		expect(weightScreenView(entries, null, "month", today, true).bmi).toBeNull();
	});
	it("year is locked for free users only", () => {
		expect(weightScreenView(entries, 175, "year", today, false).locked).toBe(true);
		expect(weightScreenView(entries, 175, "year", today, true).locked).toBe(false);
		expect(weightScreenView(entries, 175, "3m", today, false).locked).toBe(false);
	});
	it("two or more weigh-ins make a trend", () => {
		expect(weightScreenView(entries, 175, "month", today, true).state).toBe("trend");
	});
});
