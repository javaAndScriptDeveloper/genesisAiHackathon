import { describe, expect, it } from "vitest";
import { demoHistory } from "@/lib/api/mock/progressDb";
import { isValidReportWeek, weeklyReport } from "@/lib/progress/report";

describe("isValidReportWeek", () => {
	const today = "2026-11-19";
	it("accepts a finished Monday week", () => expect(isValidReportWeek("2026-11-09", today)).toBe(true));
	it("rejects non-Monday", () => expect(isValidReportWeek("2026-11-17", today)).toBe(false));
	it("rejects the current, incomplete week", () => expect(isValidReportWeek("2026-11-16", today)).toBe(false));
	it("rejects malformed and impossible dates", () => {
		expect(isValidReportWeek("nope", today)).toBe(false);
		expect(isValidReportWeek("2026-11-9", today)).toBe(false);
		expect(isValidReportWeek("2026-02-30", today)).toBe(false);
	});
	it("accepts a week that ended yesterday", () => expect(isValidReportWeek("2026-11-09", "2026-11-16")).toBe(true));
	it("rejects when the Sunday is today", () => expect(isValidReportWeek("2026-11-09", "2026-11-15")).toBe(false));
});

describe("weeklyReport", () => {
	const h = demoHistory();
	const r = weeklyReport(h, "2026-11-09");
	it("summarises the week", () => expect(r.summary.workouts).toBe(3));
	it("includes the previous week summary", () => expect(r.previous.workouts).toBeGreaterThanOrEqual(0));
	it("keeps records inside the week", () => {
		for (const p of r.records) {
			expect(p.date >= "2026-11-09" && p.date <= "2026-11-15").toBe(true);
		}
	});
	it("plans the next week", () => {
		expect(r.nextWeek.weekStart).toBe("2026-11-16");
		expect(r.nextWeek.days).toHaveLength(7);
	});
	it("never reports consistency_up", () => {
		for (const w of ["2026-11-02", "2026-11-09"]) expect(weeklyReport(h, w).insight?.id).not.toBe("consistency_up");
	});
	it("insight is null or has an id", () => expect(r.insight === null || typeof r.insight.id === "string").toBe(true));
});
