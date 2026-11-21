import { describe, expect, it } from "vitest";
import { consistencyScore, isRestKept, streakWeeks, weeklyGoal } from "@/lib/progress/consistency";
import { addDays, weekday } from "@/lib/progress/dates";
import type { History, IsoDate, PlannedDay, WorkoutSession } from "@/lib/progress/types";

function session(date: IsoDate, o: Partial<WorkoutSession> = {}): WorkoutSession {
	return {
		id: `s-${date}`,
		date,
		planned: true,
		status: "completed",
		adapted: false,
		durationMin: 40,
		setsPlanned: 10,
		sets: Array.from({ length: 10 }, () => ({ exerciseId: "squat", reps: 8, weightKg: 40, durationSec: null })),
		rpe: null,
		...o,
	};
}

const isWorkoutDay = (d: IsoDate) => [0, 2, 4].includes(weekday(d));

function planFor(from: IsoDate, days: number): PlannedDay[] {
	return Array.from({ length: days }, (_, i) => {
		const date = addDays(from, i);
		return { date, type: isWorkoutDay(date) ? "workout" : "rest" };
	});
}

/** Current week starts 2026-11-16; today is Thursday 2026-11-19. */
function build(opts: {
	fullWeeks: number;
	missedWorkoutsByWeek?: Record<number, number>; // weeksAgo (1 = last) -> n missed workouts
	today?: IsoDate;
	currentDone?: IsoDate[];
}): History {
	const today = opts.today ?? "2026-11-19";
	const start = addDays("2026-11-16", -7 * opts.fullWeeks);
	const plan = planFor(start, 7 * opts.fullWeeks + 7);
	const sessions: WorkoutSession[] = [];
	for (let w = 1; w <= opts.fullWeeks; w++) {
		const ws = addDays("2026-11-16", -7 * w);
		const workouts = [0, 2, 4].map((o) => addDays(ws, o));
		const missed = opts.missedWorkoutsByWeek?.[w] ?? 0;
		workouts.slice(0, 3 - missed).forEach((d) => sessions.push(session(d)));
	}
	(opts.currentDone ?? []).forEach((d) => sessions.push(session(d)));
	return { today, exercises: [], plan, sessions, body: [], device: null };
}

const perfect4 = build({ fullWeeks: 4 });
const lastWeekBad = build({ fullWeeks: 4, missedWorkoutsByWeek: { 1: 3 } });
const oneWeek6of7 = build({ fullWeeks: 1, missedWorkoutsByWeek: { 1: 1 } });
const h = build({ fullWeeks: 2, currentDone: ["2026-11-16", "2026-11-18"] });
// previous week bad, last week perfect -> delta > 0
const improving = build({ fullWeeks: 3, missedWorkoutsByWeek: { 2: 3 } });
const threeFullThenCurrentPartial = build({ fullWeeks: 3, currentDone: ["2026-11-16"] });
const missInLastFullWeek = build({ fullWeeks: 3, missedWorkoutsByWeek: { 1: 1 }, currentDone: ["2026-11-16"] });
const withExtra: History = {
	...h,
	sessions: [...h.sessions, session("2026-11-17", { planned: false })],
};

describe("consistency", () => {
	it("порожня історія: score null, delta null, streak 0", () => {
		const empty = { ...h, plan: [], sessions: [] };
		expect(consistencyScore(empty)).toEqual({ score: null, delta: null, fullWeeks: 0 });
		expect(streakWeeks(empty)).toBe(0);
	});
	it("4 ідеальні тижні = 100", () => {
		expect(consistencyScore(perfect4)).toMatchObject({ score: 100, fullWeeks: 4 });
	});
	it("ваги свіжий тиждень важливіший", () => {
		expect(consistencyScore(lastWeekBad).score).toBe(Math.round(100 * ((0.4 * 4) / 7 + 0.6)));
	});
	it("один повний тиждень — нормування ваг", () => {
		expect(consistencyScore(oneWeek6of7)).toMatchObject({ score: 86, fullWeeks: 1, delta: null });
	});
	it("delta = зміна відносно минулого тижня", () => {
		expect(consistencyScore(improving).delta).toBeGreaterThan(0);
	});
	it("тренування в день відпочинку — відпочинок не дотриманий", () => {
		expect(isRestKept(h, "2026-11-17")).toBe(true);
		expect(isRestKept(withExtra, "2026-11-17")).toBe(false);
		expect(isRestKept(h, "2026-11-20")).toBe(false); // у майбутньому
		expect(isRestKept(h, "2026-11-18")).toBe(false); // не rest-день
	});
	it("weeklyGoal поточного тижня", () => {
		const g = weeklyGoal(h);
		expect(g).toMatchObject({ weekStart: "2026-11-16", done: 2, planned: 3 });
		expect(g.days).toHaveLength(7);
	});
	it("streak: незавершений тиждень не обриває, пропуск обриває", () => {
		expect(streakWeeks(threeFullThenCurrentPartial)).toBe(3);
		expect(streakWeeks(missInLastFullWeek)).toBe(0);
	});
	it("streak: виконаний поточний тиждень додає 1", () => {
		const done = build({ fullWeeks: 2, currentDone: ["2026-11-16", "2026-11-18", "2026-11-20"], today: "2026-11-21" });
		expect(streakWeeks(done)).toBe(3);
	});
});
