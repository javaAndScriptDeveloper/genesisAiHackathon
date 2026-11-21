import { describe, expect, it } from "vitest";
import { toISO } from "@/lib/fit/dates";
import { summarizeActivity } from "@/lib/insights/activity";
import { summarizeCohorts, type CohortParticipant } from "@/lib/insights/cohorts";
import { createDemoAnalytics } from "@/lib/insights/demo";

const participants: CohortParticipant[] = [
	{ onboardedOn: "2026-10-05", workoutDays: new Set([1, 7, 14]), qualityWorkouts: [0, 4, 13], firstPaidDay: 35 },
	{ onboardedOn: "2026-10-11", workoutDays: new Set([2, 6, 8, 14, 30]), qualityWorkouts: [1, 2, 14], firstPaidDay: 36 },
];

describe("weekly cohorts", () => {
	it("counts exact-day retention and first-window activation and payments", () => {
		const [row] = summarizeCohorts(participants, "2026-11-16");
		expect(row).toEqual({
			start: "2026-10-05",
			end: "2026-10-11",
			size: 2,
			counts: { d1: 1, d7: 1, d14: 2, d30: 1, activation: 1, paid: 1 },
		});
	});

	it("waits for the full cohort window rather than publishing incomplete percentages", () => {
		const [row] = summarizeCohorts(participants, "2026-10-19");
		expect(row?.counts).toEqual({ d1: 1, d7: 1, d14: null, d30: null, activation: null, paid: null });
		const [rowOnDay35] = summarizeCohorts(participants, "2026-11-15");
		expect(rowOnDay35?.counts.paid).toBeNull();
	});

	it("uses the same simulated users for cohort size and recorded onboarding", () => {
		const now = new Date(2026, 10, 21, 12);
		const today = toISO(now);
		const demo = createDemoAnalytics(today);
		const activity = summarizeActivity(demo.events, "quarter", now);
		expect(activity.counts.get("onboarding_completed")).toBe(demo.cohorts.reduce((total, row) => total + row.size, 0));
		expect(demo.events.every((event) => toISO(new Date(event.at)) <= today)).toBe(true);
		expect(createDemoAnalytics(today)).toEqual(demo);
	});
});
