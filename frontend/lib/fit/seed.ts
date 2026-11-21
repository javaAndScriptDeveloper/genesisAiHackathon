import { addDays, mondayOf, mulberry32, type ISODate } from "./dates";
import { getExercise } from "./exercises";
import { evaluateAchievements } from "./gamification";
import { DEFAULT_NOTIFICATION_SETTINGS } from "./notifications";
import { estimateMinutes, generatePlan } from "./plan";
import { applyProgression, detectPrs, sessionXp, volumeOf } from "./stats";
import type { ExerciseBlock, FitState, LoggedExercise, PlannedWorkout, Profile, SessionLog } from "./types";

export const WATER_GOAL_ML = 2500;

export function emptyState(): FitState {
	return {
		version: 1,
		units: "metric",
		profile: null,
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
		bodyWeights: [],
		goalWeightKg: null,
		partners: {},
		hasDemoHistory: false,
		celebrate: [],
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
		xp: sessionXp({ status, durationSec, prs: prs.length, adHocExtra: false }),
		prs,
		demo: true,
	};
}

/** Builds five weeks of believable past training so Progress, streaks and achievements have something real to show. */
export function seedHistory(profile: Profile, today: ISODate): Pick<FitState, "planned" | "history" | "bodyWeights" | "water" | "unlocked" | "hasDemoHistory"> & { futureFrom: ISODate } {
	const rand = mulberry32(profile.age * 97 + Math.round(profile.weightKg) * 13 + profile.daysPerWeek);
	const pastStart = addDays(mondayOf(today), -35);
	const past = generatePlan(profile, pastStart, 6).filter((w) => w.date < today);
	const history: SessionLog[] = [];
	const planned: PlannedWorkout[] = [];
	past.forEach((w, i) => {
		const fromEnd = past.length - 1 - i;
		const roll = rand();
		const forceDone = fromEnd < 3;
		let status: PlannedWorkout["status"] = "completed";
		let skipReason: PlannedWorkout["skipReason"];
		if (!forceDone && i === Math.floor(past.length * 0.4)) {
			// One honest miss a few weeks back so the streak and consistency numbers look like a real person's.
			status = "skipped";
			skipReason = "busy";
		} else if (!forceDone && roll > 0.9) status = "partial";
		else if (!forceDone && roll > 0.82) {
			status = "skipped";
			skipReason = "recovery";
		}
		if (status === "skipped") return void planned.push({ ...w, status, skipReason });
		const weekIdx = Math.floor(i / Math.max(1, profile.daysPerWeek));
		const log = logFromBlocks(w.exercises, {
			id: `h-${w.id}`,
			plannedId: w.id,
			date: w.date,
			title: w.title,
			partial: status === "partial",
			weekFactor: 0.9 + weekIdx * 0.03,
			rand,
			prior: history,
		});
		history.push(log);
		planned.push({ ...w, status, logId: log.id, exercises: w.exercises.map((b) => ({ ...b, sets: b.sets.map((s) => ({ ...s, done: true })) })) });
	});

	// Upcoming targets build on what the user last lifted.
	let upcoming = generatePlan(profile, today, 4);
	for (const log of history) upcoming = applyProgression(upcoming, log, today);

	const dates = Array.from({ length: 5 }, (_, i) => addDays(today, -(4 - i) * 7));
	const trend = profile.goal === "lose-fat" ? -0.4 : profile.goal === "build-muscle" ? 0.25 : -0.1;
	const bodyWeights = dates.map((date, i) => ({ date, kg: Math.round((profile.weightKg - trend * (4 - i)) * 10) / 10 }));
	const water: Record<ISODate, number> = {};
	for (let d = 1; d <= 5; d += 1) water[addDays(today, -d)] = Math.round((1700 + rand() * 900) / 50) * 50;

	const base: FitState = { ...emptyState(), profile, planned: [...planned, ...upcoming], history, water };
	const unlockedIds = evaluateAchievements(base, today);
	const lastDate = history[history.length - 1]?.date ?? today;
	const unlocked = Object.fromEntries(unlockedIds.map((id) => [id, lastDate]));
	return { planned: [...planned, ...upcoming], history, bodyWeights, water, unlocked, hasDemoHistory: true, futureFrom: today };
}
