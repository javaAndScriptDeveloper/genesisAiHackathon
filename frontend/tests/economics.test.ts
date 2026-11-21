import { describe, expect, it } from "vitest";
import { buildMinutes, defaultScenario, estimateBuildPayback, modelEconomics, scenarios } from "@/lib/insights/economics";

describe("subscription economics", () => {
	it("derives the base case using Gemini 2.5 Flash-Lite rates", () => {
		const model = modelEconomics("base", 0.5, 5000);
		expect(model.aiPerMonth).toBeCloseTo(0.02652, 5);
		expect(model.ltv).toBeCloseTo(50.43034);
		expect(model.blendedCac).toBeCloseTo(62.83333);
		expect(model.monthlyContribution.at(-1)?.contribution).toBeCloseTo(model.ltv);
		expect(model.paybackMonths).toBeNull();
		expect(model.breakEven).toBe(1030);
	});

	it("finds the first month the modeled cohort pays back", () => {
		const model = modelEconomics("optimistic", 0.5, 5000);
		expect(model.paybackMonths).toBe(7);
		expect(model.monthlyContribution[5]?.contribution).toBeLessThan(model.blendedCac);
		expect(model.monthlyContribution[6]?.contribution).toBeGreaterThan(model.blendedCac);
	});

	it("handles zero acquisition costs without an infinite LTV/CAC", () => {
		const model = modelEconomics("base", 1, 0);
		expect(model.blendedCac).toBe(0);
		expect(model.paybackMonths).toBe(0);
		expect(model.ratio).toBeNull();
		expect(model.breakEven).toBe(0);
	});
});

describe("hackathon build payback", () => {
	it("prices 7 hours and 20 minutes at the combined hourly rate", () => {
		const base = modelEconomics("base", 1, 0);
		const build = estimateBuildPayback(50, base.firstYearContribution, base.blendedCac);
		expect(buildMinutes).toBe(440);
		expect(build.cost).toBeCloseTo(366.67);
		expect(build.payers).toBe(9);
	});

	it("cannot recover a positive build cost when the cohort loses money after CAC", () => {
		const base = modelEconomics("base", 0.5, 0);
		const build = estimateBuildPayback(50, base.firstYearContribution, base.blendedCac);
		expect(build.contributionAfterCac).toBeLessThan(0);
		expect(build.payers).toBeNull();
		expect(estimateBuildPayback(0, base.firstYearContribution, base.blendedCac).payers).toBeNull();
	});
});

it("recovers build labor and a year of overhead from 33 new payers in the launch plan", () => {
	const pilot = scenarios[defaultScenario];
	const model = modelEconomics(defaultScenario, pilot.organicPercent / 100, pilot.fixedCosts);
	const build = estimateBuildPayback(50, model.firstYearContribution, model.blendedCac, pilot.fixedCosts);
	expect(model.ratio).toBeCloseTo(4.013);
	expect(model.paybackMonths).toBe(3);
	expect(model.breakEven).toBe(11);
	expect(build.firstYearCost).toBeCloseTo(966.67);
	expect(build.payers).toBe(33);
});
