import { describe, expect, it } from "vitest";
import { parseDecimal, validateBloodPressure, validateBodyWeightInput } from "@/lib/fit/numberInput";

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

describe("validateBloodPressure", () => {
	it("accepts a normal reading and rounds", () => {
		expect(validateBloodPressure("120.4", "79.6")).toMatchObject({ systolic: 120, diastolic: 80, valid: true });
	});
	it("rejects 100.4 / 100.2 (equal after rounding)", () => {
		expect(validateBloodPressure("100.4", "100.2").valid).toBe(false);
	});
	it("range is checked on rounded values", () => {
		expect(validateBloodPressure("69.6", "60").sysError).toBe(false); // rounds to 70
		expect(validateBloodPressure("69.4", "60").sysError).toBe(true);
		expect(validateBloodPressure("250.4", "80").sysError).toBe(false); // rounds to 250
		expect(validateBloodPressure("250.6", "80").sysError).toBe(true);
	});
	it("empty fields are neither valid nor errors; garbage is an error", () => {
		expect(validateBloodPressure("", "")).toMatchObject({ valid: false, sysError: false, diaError: false });
		expect(validateBloodPressure("abc", "80")).toMatchObject({ valid: false, sysError: true });
	});
});
