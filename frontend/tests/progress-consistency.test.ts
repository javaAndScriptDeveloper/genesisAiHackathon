import { describe, expect, it } from "vitest";
import { consistencyScore, consistencyV2, isPausedWeek, isRestKept, restDayCredited, streakV2, streakWeeks, weekCredited, weeklyGoal, weekScore } from "@/lib/progress/consistency";
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

// ---- v2 ----
const W0 = "2026-11-16"; // current week (Monday); today is Thursday 2026-11-19
const wk = (ago: number): IsoDate => addDays(W0, -7 * ago);
interface WeekSpec {
	ago: number;
	n: number; // workout days planned (Mon..)
	k: number; // quality sessions done (first k)
	rest?: number; // extra rest days planned after workouts
}
function hist(specs: WeekSpec[]): History {
	const plan: PlannedDay[] = [];
	const sessions: WorkoutSession[] = [];
	for (const s of specs) {
		const ws = wk(s.ago);
		for (let i = 0; i < s.n; i++) {
			plan.push({ date: addDays(ws, i), type: "workout" });
			if (i < s.k) sessions.push(session(addDays(ws, i)));
		}
		for (let i = 0; i < (s.rest ?? 0); i++) plan.push({ date: addDays(ws, s.n + i), type: "rest" });
	}
	return { today: "2026-11-19", exercises: [], plan, sessions, body: [], device: null };
}
const ctx = (o: Partial<ProgressContext> = {}): ProgressContext => ({ weeklyGoal: 3, pauses: [], ...o });

describe("weekScore (C_week)", () => {
	it("is 0 with plan 3+4 and nothing done", () => {
		expect(weekScore(hist([{ ago: 1, n: 3, k: 0, rest: 4 }]), wk(1))).toBe(0);
	});
	it("is 100 with 3 quality sessions credits rest days", () => {
		expect(weekScore(hist([{ ago: 1, n: 3, k: 3, rest: 4 }]), wk(1))).toBe(100);
	});
	it("is null without plan", () => {
		expect(weekScore(hist([]), wk(1))).toBeNull();
	});
	it("does not credit rest days in a week without training days", () => {
		const h = hist([{ ago: 1, n: 0, k: 0, rest: 3 }]);
		expect(restDayCredited(h, wk(1))).toBe(false);
		expect(weekScore(h, wk(1))).toBe(0);
	});
	it("credits rest only when nearest training day is quality", () => {
		const h = hist([{ ago: 1, n: 3, k: 1, rest: 1 }]); // Mon done, Tue,Wed not; rest Thu next to Wed
		expect(restDayCredited(h, addDays(wk(1), 3))).toBe(false);
		const h2 = hist([{ ago: 1, n: 1, k: 1, rest: 2 }]);
		expect(restDayCredited(h2, addDays(wk(1), 1))).toBe(true);
	});
});

describe("consistencyV2", () => {
	const weeks = [
		{ ago: 1, n: 4, k: 3 }, // 75
		{ ago: 2, n: 5, k: 4 }, // 80
		{ ago: 3, n: 3, k: 3 }, // 100
		{ ago: 4, n: 5, k: 4 }, // 80
	];
	it("weighted 75/80/100/80 gives 82 and excludes the current week", () => {
		const h = hist([...weeks, { ago: 0, n: 3, k: 0 }]);
		const r = consistencyV2(h, ctx());
		expect(r.score).toBe(82);
		expect(r.weeks.map((w) => w.weight)).toEqual([0.4, 0.3, 0.2, 0.1]);
		expect(r.weeks[0]?.weekStart).toBe(wk(1));
	});
	it("renormalises with fewer weeks", () => {
		const r = consistencyV2(hist([{ ago: 1, n: 4, k: 3 }, { ago: 2, n: 5, k: 4 }]), ctx());
		expect(r.score).toBe(77); // (0.4*75+0.3*80)/0.7
		expect(r.weeks[0]?.weight).toBeCloseTo(4 / 7);
	});
	it("skips a paused week and takes the next older one", () => {
		const h = hist([...weeks, { ago: 5, n: 3, k: 0 }]);
		const c = ctx({ pauses: [{ from: wk(2), to: addDays(wk(2), 6) }] });
		const r = consistencyV2(h, c);
		expect(r.weeks.map((w) => w.weekStart)).toEqual([wk(1), wk(3), wk(4), wk(5)]);
	});
	it("null without usable weeks", () => {
		expect(consistencyV2(hist([{ ago: 0, n: 3, k: 3 }]), ctx()).score).toBeNull();
	});
});

describe("isPausedWeek", () => {
	it("any day in a valid pause counts; pause over 4 weeks is ignored", () => {
		expect(isPausedWeek(ctx({ pauses: [{ from: addDays(wk(2), 6), to: wk(1) }] }), wk(2))).toBe(true);
		expect(isPausedWeek(ctx({ pauses: [{ from: wk(5), to: addDays(wk(1), 6) }] }), wk(3))).toBe(false); // 34 days
		expect(isPausedWeek(ctx({ pauses: [{ from: wk(4), to: addDays(wk(1), 6) }] }), wk(3))).toBe(true); // 27 days, valid
	});
});

describe("weekCredited and streakV2", () => {
	it("needs quality sessions >= goal (clamped 2..5)", () => {
		const h = hist([{ ago: 1, n: 3, k: 2 }]);
		expect(weekCredited(h, ctx({ weeklyGoal: 2 }), wk(1))).toBe(true);
		expect(weekCredited(h, ctx({ weeklyGoal: 3 }), wk(1))).toBe(false);
		expect(weekCredited(h, ctx({ weeklyGoal: 0 }), wk(1))).toBe(true);
		expect(weekCredited(h, ctx({ weeklyGoal: 9 }), wk(1))).toBe(false);
	});
	it("3 credited + pause + 1 credited = 4", () => {
		const h = hist([
			{ ago: 5, n: 3, k: 3 }, { ago: 4, n: 3, k: 3 }, { ago: 3, n: 3, k: 3 },
			{ ago: 2, n: 3, k: 0 }, { ago: 1, n: 3, k: 3 },
		]);
		const c = ctx({ pauses: [{ from: wk(2), to: addDays(wk(2), 6) }] });
		expect(streakV2(h, c)).toEqual({ current: 4, best: 4 });
	});
	it("uncredited week without pause resets to 0", () => {
		const h = hist([{ ago: 2, n: 3, k: 3 }, { ago: 1, n: 3, k: 0 }]);
		expect(streakV2(h, ctx()).current).toBe(0);
		expect(streakV2(h, ctx()).best).toBe(1);
	});
	it("unfinished current week never resets, adds when credited", () => {
		const base = [{ ago: 2, n: 3, k: 3 }, { ago: 1, n: 3, k: 3 }];
		expect(streakV2(hist([...base, { ago: 0, n: 3, k: 1 }]), ctx()).current).toBe(2);
		expect(streakV2(hist([...base, { ago: 0, n: 3, k: 3 }]), ctx()).current).toBe(3);
	});
	it("best is the maximum over history", () => {
		const h = hist([
			{ ago: 5, n: 3, k: 3 }, { ago: 4, n: 3, k: 3 }, { ago: 3, n: 3, k: 3 },
			{ ago: 2, n: 3, k: 0 }, { ago: 1, n: 3, k: 3 },
		]);
		expect(streakV2(h, ctx())).toEqual({ current: 1, best: 3 });
	});
	it("empty history gives zeros", () => {
		expect(streakV2(hist([]), ctx())).toEqual({ current: 0, best: 0 });
	});
	it("a paused week that met the goal does not add to the streak", () => {
		const h = hist([
			{ ago: 4, n: 3, k: 3 }, { ago: 3, n: 3, k: 3 },
			{ ago: 2, n: 3, k: 3 }, { ago: 1, n: 3, k: 3 },
		]);
		const c = ctx({ pauses: [{ from: wk(2), to: addDays(wk(2), 6) }] });
		expect(streakV2(h, c)).toEqual({ current: 3, best: 3 });
	});
	it("a paused and credited current week does not add", () => {
		const h = hist([{ ago: 1, n: 3, k: 3 }, { ago: 0, n: 3, k: 3 }]);
		const c = ctx({ pauses: [{ from: W0, to: addDays(W0, 6) }] });
		expect(streakV2(h, c)).toEqual({ current: 1, best: 1 });
	});
});

describe("v2 edge cases", () => {
	it("rest day equidistant from quality and non-quality training day is credited", () => {
		// Mon workout (done), Tue rest, Wed workout (not done)
		const ws = wk(1);
		const h: History = {
			today: "2026-11-19", exercises: [], body: [], device: null,
			plan: [
				{ date: ws, type: "workout" },
				{ date: addDays(ws, 1), type: "rest" },
				{ date: addDays(ws, 2), type: "workout" },
			],
			sessions: [session(ws)],
		};
		expect(restDayCredited(h, addDays(ws, 1))).toBe(true);
		const h2 = { ...h, sessions: [session(addDays(ws, 2))] };
		expect(restDayCredited(h2, addDays(ws, 1))).toBe(true);
	});
	it("a pause with to before from is ignored", () => {
		expect(isPausedWeek(ctx({ pauses: [{ from: addDays(wk(1), 3), to: wk(1) }] }), wk(1))).toBe(false);
	});
});
