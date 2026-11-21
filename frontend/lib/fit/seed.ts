import { addDays, daysBetween, mondayOf, mulberry32, type ISODate } from "./dates";
import { getExercise } from "./exercises";
import { DEFAULT_NOTIFICATION_SETTINGS } from "./notifications";
import { estimateMinutes, generatePlan } from "./plan";
import { applyProgression, detectPrs, volumeOf } from "./stats";
import { historyFromFit } from "../progress/fromFit";
import { xpForSession } from "../progress/xp";
import type { ExerciseBlock, FitState, LoggedExercise, PlannedWorkout, Profile, SessionLog } from "./types";

export const WATER_GOAL_ML = 2500;
/** Hard daily ceiling for logged water: drinking far beyond this at once is not safe, so the UI stops there. */
export const WATER_MAX_ML = 5000;
export const WATER_STEP_ML = 250;

/** `crypto.randomUUID` only exists in secure contexts; the app is also served over plain HTTP. */
export function newProgressToken(): string {
	const c = globalThis.crypto;
	if (c && typeof c.randomUUID === "function") return c.randomUUID();
	const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
	return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

export function defaultWeeklyGoal(profile: Profile | null): number {
	return Math.min(5, Math.max(2, profile?.daysPerWeek ?? 3));
}

export function emptyState(): FitState {
	return {
		version: 1,
		units: "metric",
		profile: null,
		trainerId: null,
		planned: [],
		history: [],
		active: null,
		notifications: [],
		notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
		coach: [],
		unlocked: {},
		water: {},
		waterGoalMl: WATER_GOAL_ML,
		meals: {},
		subscription: { tier: "free", trialEndsAt: null },
		devices: { apple: false, garmin: false },
		bloodPressure: [],
		photos: [],
		photoInsights: [],
		photoAiConsentAt: null,
		bodyWeights: [],
		goalWeightKg: null,
		partners: {},
		partnerInvitedAt: {},
		chats: {},
		hasDemoHistory: false,
		celebrate: [],
		pauses: [],
		progressToken: newProgressToken(),
		weeklyGoal: 3,
		progressEvents: [],
		lastProgressDay: null,
		archivedWeeks: [],
		archiveQueue: [],
	};
}

function logFromBlocks(blocks: ExerciseBlock[], opts: { id: string; plannedId: string; date: ISODate; title: string; partial: boolean; weekFactor: number; rand: () => number; prior: SessionLog[] }): SessionLog {
	const { rand } = opts;
	let reached = 0;
	const exercises: LoggedExercise[] = blocks.map((block, i) => {
		const skipped = opts.partial && i >= blocks.length - 2;
		if (skipped) return { exerciseId: block.exerciseId, skipped: true, sets: [] };
		reached += 1;
		return {
			exerciseId: block.exerciseId,
			skipped: false,
			sets: block.sets.map((s) => {
				const weight = s.targetWeight ? Math.max(2.5, Math.round((s.targetWeight * opts.weekFactor) / 2.5) * 2.5) : undefined;
				const reps = getExercise(block.exerciseId).timed ? s.target : Math.max(3, s.target - (rand() < 0.2 ? 1 : 0));
				return { reps, weight };
			}),
		};
	});
	const durationSec = Math.round(estimateMinutes(blocks) * 60 * (opts.partial ? 0.6 : 0.95 + rand() * 0.1));
	const prs = detectPrs(opts.prior, exercises);
	const status = opts.partial ? "partial" : "completed";
	return {
		id: opts.id,
		plannedId: opts.plannedId,
		date: opts.date,
		title: opts.title,
		durationSec,
		status,
		exercises,
		volumeKg: volumeOf(exercises),
		perceived: rand() < 0.2 ? "hard" : rand() < 0.15 ? "easy" : "right",
		adaptations: [],
		avgHr: reached ? Math.round(112 + rand() * 18) : undefined,
		hrDemo: true,
		xp: 0, // set from the engine once the whole history exists (seedHistory)
		prs,
		demo: true,
	};
}

/** Weeks of past training in the demo history (the current week comes on top). */
export const DEMO_WEEKS = 12;
/** Weeks back from the current Monday whose workouts were all skipped under a pause (illness/holiday). */
const PAUSED_WEEK_BACK = 6;

/** Builds twelve weeks of believable past training so Progress, streaks and achievements have something real to show. Deterministic. */
export function seedHistory(profile: Profile, today: ISODate): Pick<FitState, "planned" | "history" | "bodyWeights" | "water" | "unlocked" | "hasDemoHistory" | "pauses"> & { futureFrom: ISODate } {
	const rand = mulberry32(profile.age * 97 + Math.round(profile.weightKg) * 13 + profile.daysPerWeek);
	const thisMonday = mondayOf(today);
	const pastStart = addDays(thisMonday, -7 * DEMO_WEEKS);
	const pausedMonday = addDays(thisMonday, -7 * PAUSED_WEEK_BACK);
	const pausedSunday = addDays(pausedMonday, 6);
	const past = generatePlan(profile, pastStart, DEMO_WEEKS + 1).filter((w) => w.date < today);
	const history: SessionLog[] = [];
	const planned: PlannedWorkout[] = [];
	// Fixed, deterministic misses: guarantees at least two skipped workouts outside the pause.
	const missA = past.findIndex((w) => w.date >= addDays(thisMonday, -7 * 9));
	const missB = past.findIndex((w) => w.date >= addDays(thisMonday, -7 * 3));
	past.forEach((w, i) => {
		const fromEnd = past.length - 1 - i;
		const roll = rand();
		const forceDone = fromEnd < 3;
		const inPause = w.date >= pausedMonday && w.date <= pausedSunday;
		let status: PlannedWorkout["status"] = "completed";
		let skipReason: PlannedWorkout["skipReason"];
		if (inPause) {
			status = "skipped";
			skipReason = "recovery";
		} else if (!forceDone && i === missA) {
			status = "skipped";
			skipReason = "busy";
		} else if (!forceDone && i === missB) {
			status = "skipped";
			skipReason = "recovery";
		} else if (!forceDone && roll > 0.93) status = "partial";
		if (status === "skipped") return void planned.push({ ...w, status, skipReason });
		// Loads climb slowly over the twelve weeks so PRs appear along the way.
		const weekIdx = Math.floor(daysBetween(pastStart, w.date) / 7);
		const log = logFromBlocks(w.exercises, {
			id: `h-${w.id}`,
			plannedId: w.id,
			date: w.date,
			title: w.title,
			partial: status === "partial",
			weekFactor: 0.85 + weekIdx * 0.025,
			rand,
			prior: history,
		});
		history.push(log);
		planned.push({ ...w, status, logId: log.id, exercises: w.exercises.map((b) => ({ ...b, sets: b.sets.map((s) => ({ ...s, done: true })) })) });
	});

	// Upcoming targets build on what the user last lifted.
	let upcoming = generatePlan(profile, today, 4);
	for (const log of history) upcoming = applyProgression(upcoming, log, today);

	// 3–5 weigh-ins a week around a slow trend, with ±0.8 kg noise from its own seeded stream.
	const wRand = mulberry32(profile.age * 31 + Math.round(profile.weightKg) * 7 + 12);
	const perWeek = profile.goal === "lose-fat" ? -0.35 : profile.goal === "build-muscle" ? 0.2 : -0.08;
	const bodyWeights: FitState["bodyWeights"] = [];
	for (let w = DEMO_WEEKS; w >= 0; w -= 1) {
		const monday = addDays(thisMonday, -7 * w);
		const count = 3 + Math.floor(wRand() * 3);
		const slots = [0, 1, 2, 3, 4, 5, 6].sort(() => wRand() - 0.5).slice(0, count).sort((x, y) => x - y);
		for (const slot of slots) {
			const date = addDays(monday, slot);
			if (date > today) continue;
			const weeksBack = daysBetween(date, today) / 7;
			const noise = (wRand() * 2 - 1) * 0.8;
			bodyWeights.push({ date, kg: Math.round((profile.weightKg - perWeek * weeksBack + noise) * 10) / 10, at: `${date}T07:30:00.000Z` });
		}
	}
	const water: Record<ISODate, number> = {};
	for (let d = 1; d <= 5; d += 1) water[addDays(today, -d)] = Math.round((1700 + rand() * 900) / 50) * 50;

	const pauses = [{ from: pausedMonday, to: pausedSunday }];
	const all = [...planned, ...upcoming];
	// Per-session XP comes from lib/progress, like every other progress number. Badges are derived, never stored.
	const h = historyFromFit({ planned: all, history, bodyWeights }, today);
	const ctx = { weeklyGoal: defaultWeeklyGoal(profile), pauses };
	const scored = history.map((l) => ({ ...l, xp: xpForSession(h, ctx, l.id).total }));
	return { planned: all, history: scored, bodyWeights, water, unlocked: {}, hasDemoHistory: true, pauses, futureFrom: today };
}
