import { describe, expect, it } from "vitest";
import { demoHistory } from "@/lib/api/mock/progressDb";
import { exerciseProgressView } from "@/lib/progress/exerciseView";

describe("exerciseProgressView", () => {
	it("pushup: reps metric, best 12, at most 8 points in order", () => {
		const v = exerciseProgressView(demoHistory(), "pushup");
		expect(v.metric).toBe("reps");
		expect(v.best).toBe(12);
		expect(v.points.length).toBeGreaterThan(1);
		expect(v.points.length).toBeLessThanOrEqual(8);
		const dates = v.points.map((p) => p.date);
		expect([...dates].sort()).toEqual(dates);
	});
	it("records: at most 3, newest first, main metric only", () => {
		const v = exerciseProgressView(demoHistory(), "pushup");
		expect(v.records.length).toBeLessThanOrEqual(3);
		const dates = v.records.map((r) => r.date);
		expect([...dates].sort().reverse()).toEqual(dates);
		expect(v.records.every((r) => r.exerciseId === "pushup" && r.metric === "reps")).toBe(true);
	});
	it("unknown id gives an empty view", () => {
		expect(exerciseProgressView(demoHistory(), "nope")).toEqual({ metric: null, points: [], best: null, records: [] });
	});
});
