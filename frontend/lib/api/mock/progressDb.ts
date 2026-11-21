import { addDays, eachDay, weekday } from "@/lib/progress/dates";
import type { BodyMeasurement, Exercise, History, IsoDate, PlannedDay, Rpe, SetLog, WorkoutSession } from "@/lib/progress/types";

const TODAY: IsoDate = "2026-11-19";
const START: IsoDate = "2026-09-28";
const PLAN_END: IsoDate = "2026-11-29";

const MISSED = new Set<IsoDate>(["2026-10-07", "2026-10-16", "2026-10-23"]);
const ADAPTED = new Set<IsoDate>(["2026-11-02", "2026-11-06"]);
const HARD = new Set<IsoDate>(["2026-10-12", "2026-10-14", "2026-10-19"]);
/** Light unplanned Saturday sessions: the rest day is not "kept", which keeps the score believable. */
const EXTRA_DAYS: IsoDate[] = ["2026-10-31", "2026-11-07"];

const EXERCISES: Exercise[] = [
	{ id: "pushup", name: "Віджимання", kind: "bodyweight" },
	{ id: "goblet_squat", name: "Присідання з гантеллю", kind: "weighted" },
	{ id: "db_row", name: "Тяга гантелі в нахилі", kind: "weighted" },
	{ id: "lunge", name: "Випади з гантелями", kind: "weighted" },
	{ id: "glute_bridge", name: "Сідничний міст", kind: "bodyweight" },
	{ id: "plank", name: "Планка", kind: "timed" },
	{ id: "db_press", name: "Жим гантелей сидячи", kind: "weighted" },
];

/** Explicit step-ups of the per-session best; everything else stays flat. */
const PUSHUP_REPS: [IsoDate, number][] = [
	["2026-09-28", 8],
	["2026-10-12", 10],
	["2026-11-04", 11],
	["2026-11-13", 12],
];
const GOBLET_KG: [IsoDate, number][] = [
	["2026-09-28", 12],
	["2026-10-09", 14],
	["2026-11-06", 16],
];

function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function levelAt(steps: [IsoDate, number][], date: IsoDate): number {
	let v = steps[0]?.[1] ?? 0;
	for (const [d, x] of steps) if (d <= date) v = x;
	return v;
}

function isStep(steps: [IsoDate, number][], date: IsoDate): boolean {
	return steps.slice(1).some(([d]) => d === date);
}

function buildSessions(): WorkoutSession[] {
	const rnd = mulberry32(20261121);
	const sessions: WorkoutSession[] = [];
	const days = eachDay(START, TODAY).filter((d) => [0, 2, 4].includes(weekday(d)) && !MISSED.has(d));
	let afterHard = 0;
	for (const date of days) {
		// Downward noise only: the session best may dip, never exceed the current level.
		const dip = (steps: [IsoDate, number][] | null) => (steps !== null && isStep(steps, date) ? 0 : rnd() < 0.3 ? 1 : 0);
		const pushTop = levelAt(PUSHUP_REPS, date) - dip(PUSHUP_REPS);
		const gobletKg = levelAt(GOBLET_KG, date);
		const gobletReps = 10 - dip(GOBLET_KG);
		const w = (exerciseId: string, weightKg: number, reps: number): SetLog => ({ exerciseId, reps, weightKg, durationSec: null });
		const b = (exerciseId: string, reps: number): SetLog => ({ exerciseId, reps, weightKg: null, durationSec: null });
		const t = (sec: number): SetLog => ({ exerciseId: "plank", reps: 1, weightKg: null, durationSec: sec });
		const sets: SetLog[] = [
			b("pushup", pushTop),
			b("pushup", pushTop - 1 - Math.floor(rnd() * 2)),
			w("goblet_squat", gobletKg, gobletReps),
			w("goblet_squat", gobletKg, gobletReps - 1 - Math.floor(rnd() * 2)),
			w("db_row", 14, 10 - dip(null)),
			w("db_row", 14, 8),
			w("lunge", 8, 10 - dip(null)),
			w("lunge", 8, 8),
			b("glute_bridge", 15 - dip(null)),
			t(45 - 5 * Math.floor(rnd() * 3) * (rnd() < 0.3 ? 1 : 0)),
			w("db_press", 10, 10 - dip(null)),
			w("db_press", 10, 8),
		];
		const adapted = ADAPTED.has(date);
		let rpe: Rpe;
		if (HARD.has(date)) rpe = "hard";
		else if (date < "2026-10-12") rpe = "ok";
		else rpe = (afterHard += 1) % 3 === 0 ? "easy" : "ok";
		sessions.push({
			id: `s-${date}`,
			date,
			planned: true,
			status: "completed",
			adapted,
			durationMin: 25 + Math.floor(rnd() * 11),
			setsPlanned: 12,
			// Adapted workouts drop two low-priority sets but stay "quality" (>= 70%).
			sets: adapted ? sets.filter((_, i) => i !== 7 && i !== 11) : sets,
			rpe,
		});
	}
	for (const date of EXTRA_DAYS) {
		sessions.push({
			id: `s-${date}`,
			date,
			planned: false,
			status: "completed",
			adapted: false,
			durationMin: 20 + Math.floor(rnd() * 6),
			setsPlanned: 6,
			sets: [
				{ exerciseId: "pushup", reps: 7, weightKg: null, durationSec: null },
				{ exerciseId: "glute_bridge", reps: 12, weightKg: null, durationSec: null },
				{ exerciseId: "plank", reps: 1, weightKg: null, durationSec: 30 },
			],
			rpe: null,
		});
	}
	return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

const BODY_KG = [72.0, 71.8, 71.5, 71.6, 71.2, 71.0, 70.8, 70.5];

function buildBody(): BodyMeasurement[] {
	return BODY_KG.map((weightKg, i) => ({ date: addDays(START, i * 7), weightKg }));
}

function buildPlan(): PlannedDay[] {
	return eachDay(START, PLAN_END).map((date) => ({ date, type: [0, 2, 4].includes(weekday(date)) ? "workout" : "rest" }));
}

const DEMO: History = {
	today: TODAY,
	exercises: EXERCISES,
	plan: buildPlan(),
	sessions: buildSessions(),
	body: buildBody(),
	checkIns: [], device: { avgWorkoutHeartRate: 128, avgDailySteps: 7400, avgSleepHours: 7.1 },
};

export function demoHistory(): History {
	return structuredClone(DEMO);
}

export function emptyHistory(): History {
	return { ...structuredClone(DEMO), sessions: [], body: [], checkIns: [], device: null };
}
