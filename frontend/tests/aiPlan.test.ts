import { describe, expect, it } from "vitest";
import { statsSummary, statusForReadiness, type DailyStats } from "@/lib/fit/dailyStats";
import { toBackendUser } from "@/lib/fit/backendUser";
import type { Profile } from "@/lib/fit/types";

const profile: Profile = {
	name: "Ann",
	age: 30,
	gender: "female",
	heightCm: 170,
	weightKg: 60,
	goal: "stay-fit",
	experience: "beginner",
	location: "home",
	equipment: ["bands"],
	durationMin: 30,
	daysPerWeek: 3,
	limitations: [],
	limitationNote: "",
	wearable: "none",
};

function stat(date: string, readiness: number): DailyStats {
	return { date, sleepHours: 7, sleepScore: 80, restingHr: 58, hrvMs: 60, steps: 5000, activeKcal: 300, readiness, source: "demo", scenario: "normal" };
}

describe("statusForReadiness", () => {
	it("maps the bands", () => {
		expect(statusForReadiness(60)).toBe("unchanged");
		expect(statusForReadiness(59)).toBe("lighter");
		expect(statusForReadiness(40)).toBe("lighter");
		expect(statusForReadiness(39)).toBe("recovery");
	});
});

describe("statsSummary", () => {
	it("handles empty data", () => {
		expect(statsSummary([])).toBe("No device data.");
	});
	it("summarises a window", () => {
		const s = statsSummary([stat("2026-11-20", 70), { ...stat("2026-11-21", 32), scenario: "bad-night" }]);
		expect(s).toContain("readiness today 32/100 (bad-night)");
		expect(s).toContain("2 days");
	});
});

describe("toBackendUser", () => {
	it("derives dob from age", () => {
		expect(toBackendUser(profile, "hanna", "2026-11-21").dob).toBe("1996-11-21");
		expect(toBackendUser(profile, "hanna", "2028-02-29").dob).toBe("1998-02-28");
	});
	it("maps gender, level and onboarding", () => {
		const u = toBackendUser({ ...profile, gender: "private" }, "hanna", "2026-11-21");
		expect(u.gender).toBeNull();
		expect(u.level).toBe("beginner");
		expect(u.trainerSlug).toBe("hanna");
		expect(u.onboarding).toHaveProperty("goal");
		expect(u.onboarding).toHaveProperty("equipment");
		expect(u.onboarding).toHaveProperty("daysPerWeek");
		expect(u.onboarding).not.toHaveProperty("name");
	});
});
