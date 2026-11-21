import { describe, expect, it } from "vitest";
import { EVAL_CASES, FIXTURE_TRAINERS } from "@/evals/cases";
import { NUDGE_KINDS } from "@/lib/fit/nudge";

describe("eval cases (offline, no Gemini)", () => {
	it("cover all five trainers and every kind", () => {
		expect(new Set(EVAL_CASES.map((c) => c.trainerId))).toEqual(new Set(["mike", "john", "hanna", "caroline", "alex"]));
		expect(new Set(EVAL_CASES.map((c) => c.kind))).toEqual(new Set(NUDGE_KINDS));
	});
	it("have unique ids and known trainers", () => {
		expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(EVAL_CASES.length);
		for (const c of EVAL_CASES) expect(FIXTURE_TRAINERS.some((t) => t.id === c.trainerId)).toBe(true);
	});
});
