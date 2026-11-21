import { describe, expect, it } from "vitest";
import { calendarDayState, calendarMonth, dayDetails, shiftMonth, weekDetails } from "@/lib/progress/calendar";
import { restDayCredited } from "@/lib/progress/consistency";
import { addDays, weekday } from "@/lib/progress/dates";
import type { History, IsoDate, PlannedDay, ProgressContext, WorkoutSession } from "@/lib/progress/types";

function session(date: IsoDate, o: Partial<WorkoutSession> = {}): WorkoutSession {
	return {
		id: `s-${date}`,
		date,
		planned: true,
		status: "completed",
		adapted: false,
		durationMin: 40,
		setsPlanned: 10,
		sets: Array.from({ length: 10 }, (_, i) => ({ exerciseId: i < 6 ? "squat" : "plank", reps: 8, weightKg: 40, durationSec: null })),
		rpe: null,
		...o,
	};
}

const isWorkoutDay = (d: IsoDate) => [0, 2, 4].includes(weekday(d)); // Mon, Wed, Fri

function planFor(from: IsoDate, days: number): PlannedDay[] {
	return Array.from({ length: days }, (_, i) => {
		const date = addDays(from, i);
		return { date, type: isWorkoutDay(date) ? "workout" : "rest" };
	});
}

const TODAY = "2026-11-19"; // Thursday; current week starts Mon 2026-11-16
const ctx: ProgressContext = { weeklyGoal: 3, pauses: [] };

function history(sessions: WorkoutSession[], plan = planFor("2026-11-02", 42)): History {
	return {
		today: TODAY,
		exercises: [
			{ id: "squat", name: "Squat", kind: "weighted" },
			{ id: "plank", name: "Plank", kind: "timed" },
		],
		plan,
		sessions,
		body: [],
		device: null,
	};
}

// Week of Nov 2: all three done. Week of Nov 9: Mon done, Wed missed, Fri done. Current week: Mon + Wed done.
const S = [
	session("2026-11-02"),
	session("2026-11-04"),
	session("2026-11-06"),
	session("2026-11-09"),
	session("2026-11-13"),
	session("2026-11-16"),
	session("2026-11-18"),
];

describe("calendarDayState", () => {
	const h = history(S);
	it("covers every state", () => {
		expect(calendarDayState(h, ctx, "2026-11-16")).toBe("training-done");
		expect(calendarDayState(h, ctx, "2026-11-17")).toBe("rest-credited"); // nearest Mon/Wed done
		expect(calendarDayState(h, ctx, "2026-11-11")).toBe("missed");
		expect(calendarDayState(h, ctx, "2026-11-12")).toBe("rest-credited"); // tie Wed (missed) / Fri (done) → done one wins
		expect(calendarDayState(h, ctx, TODAY)).toBe("rest-credited"); // tie Wed (done) / Fri (upcoming)
		expect(calendarDayState(history([], planFor(TODAY, 28)), ctx, TODAY)).toBe("today"); // nothing logged yet
		expect(calendarDayState(h, ctx, "2026-11-20")).toBe("planned");
		expect(calendarDayState(h, ctx, "2026-11-21")).toBe("rest");
		expect(calendarDayState(h, ctx, "2026-10-30")).toBe("none"); // before the first plan date
		expect(calendarDayState(h, { ...ctx, pauses: [{ from: "2026-11-09", to: "2026-11-15" }] }, "2026-11-11")).toBe("paused");
	});

	it("rest day next to a missed workout is not credited", () => {
		const hm = history([session("2026-11-09")]);
		expect(calendarDayState(hm, ctx, "2026-11-10")).toBe("rest-credited");
		expect(calendarDayState(hm, ctx, "2026-11-14")).toBe("rest"); // nearest Fri missed
		expect(dayDetails(hm, ctx, "2026-11-14").rest).toEqual({ credited: false, reason: "nearest-not-done", nearest: "2026-11-13" });
	});

	it("a logged but low-quality workout shows as done, flagged as not quality", () => {
		const hq = history([session("2026-11-16", { sets: [{ exerciseId: "squat", reps: 5, weightKg: 40, durationSec: null }] })]);
		expect(calendarDayState(hq, ctx, "2026-11-16")).toBe("training-done");
		expect(dayDetails(hq, ctx, "2026-11-16").sessions[0]?.quality).toBe(false);
	});
});

describe("calendarMonth", () => {
	const m = calendarMonth(history(S), ctx, "2026-11");
	it("is Monday-first with full weeks covering the month", () => {
		expect(m.weeks).toHaveLength(6); // Oct 26 … Dec 6
		expect(m.weeks[0]?.weekStart).toBe("2026-10-26");
		expect(m.weeks[0]?.days[0]?.inMonth).toBe(false);
		expect(m.weeks.every((w) => w.days.length === 7 && weekday(w.weekStart) === 0)).toBe(true);
	});

	it("marks today once", () => {
		const todays = m.weeks.flatMap((w) => w.days).filter((d) => d.isToday);
		expect(todays.map((d) => d.date)).toEqual([TODAY]);
	});

	it("week summary: credited, current, score", () => {
		const byStart = (ws: IsoDate) => m.weeks.find((w) => w.weekStart === ws)?.week;
		expect(byStart("2026-11-02")).toEqual({ credited: true, paused: false, current: false, score: 100 });
		expect(byStart("2026-11-09")?.credited).toBe(false);
		expect(byStart("2026-11-16")?.current).toBe(true);
		expect(byStart("2026-11-23")?.score).toBeNull();
	});

	it("paused week", () => {
		const paused = calendarMonth(history(S), { ...ctx, pauses: [{ from: "2026-11-09", to: "2026-11-15" }] }, "2026-11");
		const wk = paused.weeks.find((w) => w.weekStart === "2026-11-09");
		expect(wk?.week.paused).toBe(true);
		expect(wk?.days.find((d) => d.date === "2026-11-11")?.state).toBe("paused");
		expect(wk?.days.find((d) => d.date === "2026-11-09")?.state).toBe("training-done");
	});

	it("S0: only a plan from today, no sessions → future planned, nothing missed", () => {
		const s0 = history([], planFor(TODAY, 28));
		const days = calendarMonth(s0, ctx, "2026-11").weeks.flatMap((w) => w.days);
		expect(days.some((d) => d.state === "missed")).toBe(false);
		expect(days.find((d) => d.date === "2026-11-18")?.state).toBe("none");
		expect(days.find((d) => d.date === "2026-11-20")?.state).toBe("planned");
		expect(days.find((d) => d.date === "2026-11-21")?.state).toBe("rest");
	});

	it("S0-like plan that started earlier: missed only after the first plan date", () => {
		const s0 = history([], planFor("2026-11-16", 28));
		const days = calendarMonth(s0, ctx, "2026-11").weeks.flatMap((w) => w.days);
		expect(days.filter((d) => d.state === "missed").map((d) => d.date)).toEqual(["2026-11-16", "2026-11-18"]);
		expect(days.find((d) => d.date === "2026-11-13")?.state).toBe("none");
	});
});

describe("details", () => {
	it("dayDetails lists exercises, sets and minutes", () => {
		const d = dayDetails(history(S), ctx, "2026-11-16");
		expect(d.planned).toBe("workout");
		expect(d.sessions[0]).toMatchObject({ minutes: 40, quality: true, completedSets: 10, plannedSets: 10 });
		expect(d.sessions[0]?.exercises).toEqual([
			{ id: "squat", name: "Squat", sets: 6 },
			{ id: "plank", name: "Plank", sets: 4 },
		]);
		expect(dayDetails(history(S), ctx, "2026-11-11").missed).toBe(true);
		expect(dayDetails(history(S), ctx, "2026-11-21").future).toBe(true);
	});

	it("weekDetails explains C_week", () => {
		const w = weekDetails(history(S), ctx, "2026-11-09");
		expect(w).toMatchObject({ plannedDays: 7, plannedWorkouts: 3, qualityWorkouts: 2, goal: 3 });
		// Tue (Mon done), Thu (tie → Fri done), Sat + Sun (Fri done) credited
		expect(w.creditedRest).toBe(4);
		expect(w.summary.score).toBe(86);
		expect(w.weight).toBeCloseTo(0.4 / 0.7, 5); // 2 counted weeks, weights renormalised
	});

	it("shiftMonth crosses years", () => {
		expect(shiftMonth("2026-01", -1)).toBe("2025-12");
		expect(shiftMonth("2026-12", 1)).toBe("2027-01");
	});
});

describe("calendar agrees with consistency", () => {
	it("rest-credited cells equal restDayCredited for every past day of a month", () => {
		// Mixed month: quality, low-quality and missed workouts.
		const h = history([...S, session("2026-11-11", { sets: [{ exerciseId: "squat", reps: 5, weightKg: 40, durationSec: null }] })]);
		const days = calendarMonth(h, ctx, "2026-11").weeks.flatMap((w) => w.days).filter((d) => d.date <= TODAY);
		expect(days.length).toBeGreaterThan(20);
		for (const d of days) expect([d.date, d.state === "rest-credited"]).toEqual([d.date, restDayCredited(h, d.date)]);
	});
});
