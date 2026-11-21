import { describe, expect, it } from "vitest";
import { demoHistory, emptyHistory } from "@/lib/api/mock/progressDb";
import { consistencyScore, insights, periodSummary, personalRecords, streakWeeks, weeklyGoal } from "@/lib/progress";

const h = demoHistory();

describe("demoHistory", () => {
	it("детермінований", () => expect(demoHistory()).toEqual(h));
	it("3 пропуски, серія 3 тижні, тиждень 2 з 3", () => {
		expect(periodSummary(h, "2026-09-28", h.today).missed).toBe(3);
		expect(streakWeeks(h)).toBe(3);
		expect(weeklyGoal(h)).toMatchObject({ done: 2, planned: 3 });
	});
	it("6–8 рекордів", () => {
		const n = personalRecords(h).length;
		expect(n).toBeGreaterThanOrEqual(6);
		expect(n).toBeLessThanOrEqual(8);
	});
	it("інсайти для демо: п'ятниці й ріст сили, без too_hard", () => {
		const ids = insights(h).map((i) => i.id);
		expect(ids).toEqual(["weekday_misses", "strength_gain"]);
	});
	it("consistency в діапазоні 60–95 і зростає", () => {
		const c = consistencyScore(h);
		expect(c.score).toBeGreaterThanOrEqual(60);
		expect(c.score).toBeLessThanOrEqual(95);
		expect(c.delta).toBeGreaterThan(0);
	});
	it("не ділиться змінним станом", () => {
		const a = demoHistory();
		a.sessions.pop();
		expect(demoHistory()).toEqual(h);
	});
	it("emptyHistory без сесій", () => {
		const e = emptyHistory();
		expect(e.sessions).toEqual([]);
		expect(e.body).toEqual([]);
		expect(e.device).toBeNull();
		expect(e.plan).toEqual(h.plan);
	});
});
