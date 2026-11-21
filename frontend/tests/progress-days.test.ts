import { afterEach, describe, expect, it } from "vitest";
import { addDays, eachDay, weekStart, weekday } from "@/lib/progress/dates";
import { dayStatus, isQualitySession } from "@/lib/progress/days";
import type { History, PlannedDay, SetLog, WorkoutSession } from "@/lib/progress/types";

function session(o: Partial<Omit<WorkoutSession, "sets">> & { sets?: number } = {}): WorkoutSession {
	const { sets = 10, ...rest } = o;
	const log: SetLog = { exerciseId: "squat", reps: 8, weightKg: 40, durationSec: null };
	return {
		id: "s1",
		date: "2026-11-16",
		planned: true,
		status: "completed",
		adapted: false,
		durationMin: 40,
		setsPlanned: 10,
		sets: Array.from({ length: sets }, () => log),
		rpe: null,
		...rest,
	};
}

const plan: PlannedDay[] = Array.from({ length: 14 }, (_, i) => {
	const date = addDays("2026-11-09", i);
	return { date, type: [0, 2, 4].includes(weekday(date)) ? "workout" : "rest" };
});

const h: History = {
	today: "2026-11-19",
	exercises: [],
	plan,
	sessions: [
		session({ id: "a", date: "2026-11-16" }),
		session({ id: "b", date: "2026-11-11", adapted: true }),
	],
	body: [],
	checkIns: [], device: null,
};

describe("dates", () => {
	const originalTz = process.env.TZ;
	afterEach(() => {
		if (originalTz === undefined) delete process.env.TZ;
		else process.env.TZ = originalTz;
	});
	it("weekStart: неділя належить тижню з понеділка перед нею", () => {
		expect(weekStart("2026-11-22")).toBe("2026-11-16");
		expect(weekStart("2026-11-16")).toBe("2026-11-16");
	});
	it("не залежить від часового поясу", () => {
		process.env.TZ = "America/Los_Angeles";
		expect(weekday("2026-11-16")).toBe(0);
		process.env.TZ = "Pacific/Kiritimati";
		expect(weekday("2026-11-22")).toBe(6);
	});
	it("addDays переходить через місяць", () => expect(addDays("2026-10-30", 3)).toBe("2026-11-02"));
	it("eachDay включно", () => expect(eachDay("2026-11-16", "2026-11-18")).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]));
});

describe("isQualitySession", () => {
	it("70% підходів — якісне", () => expect(isQualitySession(session({ setsPlanned: 10, sets: 7 }))).toBe(true));
	it("69% — ні", () => expect(isQualitySession(session({ setsPlanned: 13, sets: 9 }))).toBe(false));
	it("незаплановане або покинуте — ні", () => {
		expect(isQualitySession(session({ planned: false }))).toBe(false);
		expect(isQualitySession(session({ status: "abandoned" }))).toBe(false);
	});
});

describe("dayStatus", () => {
	it("completed / adapted / missed / planned / rest / none", () => {
		expect(dayStatus(h, "2026-11-16")).toBe("completed");
		expect(dayStatus(h, "2026-11-11")).toBe("adapted");
		expect(dayStatus(h, "2026-11-13")).toBe("missed");
		expect(dayStatus(h, "2026-11-20")).toBe("planned");
		expect(dayStatus(h, "2026-11-17")).toBe("rest");
		expect(dayStatus(h, "2025-01-01")).toBe("none");
	});
});
