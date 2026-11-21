import { describe, expect, it } from "vitest";
import { insightCopy } from "@/lib/progress/insightCopy";
import type { Insight } from "@/lib/progress/insights";
import { t } from "@/lib/messages";

const samples: Insight[] = [
	{ id: "weekday_misses", vars: { weekday: 2 } },
	{ id: "strength_gain", vars: { exerciseId: "pushup", exercise: "Push-up", from: 8, to: 12, weeks: 3 } },
	{ id: "consistency_up", vars: { delta: 6 } },
	{ id: "too_hard", vars: {} },
];

describe("insightCopy", () => {
	for (const i of samples) {
		it(`resolves real copy for ${i.id}`, () => {
			const c = insightCopy(i, t);
			for (const s of [c.title, c.next]) {
				expect(s.length).toBeGreaterThan(0);
				expect(s).not.toContain("{");
				expect(s.startsWith("fit.progress.")).toBe(false);
			}
		});
	}
	it("formats strength gain", () => {
		expect(insightCopy(samples[1]!, t).title).toBe("Push-up: 8 → 12 in 3 wk");
	});
	it("localizes the weekday", () => {
		expect(insightCopy(samples[0]!, t).title).toBe("Wednesday sessions slip most often");
	});
});
