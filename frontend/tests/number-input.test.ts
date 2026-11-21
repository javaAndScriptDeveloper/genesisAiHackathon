import { describe, expect, it } from "vitest";
import { parseDecimal, validateBodyWeightInput } from "@/lib/fit/numberInput";

describe("parseDecimal", () => {
	it.each([
		["62,5", 62.5],
		["62.5", 62.5],
		[" 70 ", 70],
		["70,", 70],
		[",5", 0.5],
	])("%j -> %j", (raw, out) => expect(parseDecimal(raw)).toBe(out));
	it.each(["", "  ", "6,2,5", "6.2.5", "6,2.5", "abc", "1e2", "-5", "+5", ".", ",", "6 2"])("%j -> null", (raw) => expect(parseDecimal(raw)).toBeNull());
});

describe("validateBodyWeightInput", () => {
	it("accepts a comma decimal in metric", () => expect(validateBodyWeightInput("62,5", "metric")).toEqual({ kg: 62.5, error: false }));
	it("converts imperial", () => {
		const r = validateBodyWeightInput("150", "imperial");
		expect(r.error).toBe(false);
		expect(r.kg).toBeCloseTo(68.04, 1);
	});
	it("flags out of range and garbage", () => {
		expect(validateBodyWeightInput("625", "metric").error).toBe(true);
		expect(validateBodyWeightInput("20", "metric").error).toBe(true);
		expect(validateBodyWeightInput("abc", "metric").error).toBe(true);
	});
	it("empty is not an error but has no value", () => expect(validateBodyWeightInput("", "metric")).toEqual({ kg: null, error: false }));
});
