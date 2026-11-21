import { describe, expect, it } from "vitest";
import { adviceCopy, comparisonRows, goalOptions, improvementCopy } from "@/lib/progress/reportScreen";

const t = (workouts: number, minutes: number, qualitySets: number, xp: number) => ({ workouts, minutes, qualitySets, xp });

describe("comparisonRows", () => {
	const rows = comparisonRows(t(3, 100, 20, 300), t(2, 120, 20, 100));
	it("covers workouts, minutes, quality sets and XP in order", () => expect(rows.map((r) => r.metric)).toEqual(["workouts", "minutes", "qualitySets", "xp"]));
	it("computes deltas and directions", () => {
		expect(rows.map((r) => r.delta)).toEqual([1, -20, 0, 200]);
		expect(rows.map((r) => r.direction)).toEqual(["up", "down", "same", "up"]);
	});
	it("keeps decreases and no change neutral, only increases positive", () => expect(rows.map((r) => r.tone)).toEqual(["positive", "neutral", "neutral", "positive"]));
});

describe("goalOptions", () => {
	it("offers 2..5 and marks the recommended and current ones", () => {
		const o = goalOptions(4, 3);
		expect(o.map((x) => x.value)).toEqual([2, 3, 4, 5]);
		expect(o.filter((x) => x.recommended).map((x) => x.value)).toEqual([4]);
		expect(o.filter((x) => x.selected).map((x) => x.value)).toEqual([3]);
	});
	it("handles recommended equal to current", () => {
		const o = goalOptions(2, 2);
		expect(o[0]).toEqual({ value: 2, recommended: true, selected: true });
	});
});

describe("copy helpers", () => {
	const ex = [{ id: "bp", name: "Bench", kind: "weighted" }] as never;
	it("formats record improvement masses through the formatter", () => {
		const c = improvementCopy({ kind: "record", exerciseId: "bp", metric: "e1rm", now: 100, before: 90, delta: 10 }, ex, (kg) => `${kg} kg`);
		expect(c).toEqual({ key: "fit.progress.improvements.record", params: { exercise: "Bench", before: "90 kg", now: "100 kg", delta: "10 kg" } });
	});
	it("uses a singular key for one remaining session", () => {
		expect(adviceCopy({ id: "goal-remaining", vars: { n: 1 } }, ex, String).key).toBe("fit.progress.advice.goal-remaining-one");
		expect(adviceCopy({ id: "goal-remaining", vars: { n: 2 } }, ex, String).key).toBe("fit.progress.advice.goal-remaining");
	});
});
