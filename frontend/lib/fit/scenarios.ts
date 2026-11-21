import { addDays, mondayOf, type ISODate } from "./dates";
import { getExercise } from "./exercises";
import { badges } from "../progress/badges";
import { progressOf } from "./store/progressStats";
import { reducer } from "./store/reducer";
import { DEMO_PHOTO_AFTER, DEMO_PHOTO_BEFORE } from "./demoPhotos";
import { emptyState } from "./seed";
import type { FitState, PlannedWorkout, Profile, SessionLog } from "./types";

export type ScenarioId = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
export const SCENARIO_IDS: ScenarioId[] = ["S0", "S1", "S2", "S3", "S4", "S5", "S6"];

/** Fixed per scenario so the fixtures are byte-for-byte reproducible. */
const TOKENS: Record<ScenarioId, string> = {
	S0: "00000000-0000-4000-8000-0000000000a0",
	S1: "00000000-0000-4000-8000-0000000000a1",
	S2: "00000000-0000-4000-8000-0000000000a2",
	S3: "00000000-0000-4000-8000-0000000000a3",
	S4: "00000000-0000-4000-8000-0000000000a4",
	S5: "00000000-0000-4000-8000-0000000000a5",
	S6: "00000000-0000-4000-8000-0000000000a6",
};

const PROFILE: Profile = {
	name: "Scenario",
	age: 30,
	gender: "female",
	heightCm: 168,
	weightKg: 70,
	goal: "build-muscle",
	experience: "intermediate",
	location: "gym",
	equipment: ["dumbbells", "bench", "barbell", "machines"],
	durationMin: 45,
	daysPerWeek: 3,
	limitations: [],
	limitationNote: "",
	wearable: "none",
};

/** The plan generator stamps block ids from the clock; rewrite them from position so fixtures are reproducible. */
function stabilize(state: FitState): FitState {
	return { ...state, planned: state.planned.map((w) => ({ ...w, exercises: w.exercises.map((b, i) => ({ ...b, id: `${w.id}-b${i}` })) })) };
}

function base(today: ISODate, units: FitState["units"], demoHistory: boolean): FitState {
	return stabilize(reducer(emptyState(), { type: "complete-onboarding", profile: PROFILE, units, demoHistory, today, now: `${today}T08:00:00.000Z` }));
}

/** Unlinks planned workouts whose log was removed, so the plan does not point at missing sessions. */
function dropLogs(state: FitState, keep: (log: SessionLog) => boolean): FitState {
	const history = state.history.filter(keep);
	const kept = new Set(history.map((l) => l.id));
	const planned = state.planned.map((w): PlannedWorkout => {
		if (!w.logId || kept.has(w.logId)) return w;
		const { logId: _unused, ...rest } = w;
		void _unused;
		return { ...rest, status: "skipped", skipReason: "busy" };
	});
	return { ...state, history, planned };
}

function s2(today: ISODate): FitState {
	let state = base(today, "metric", true);
	// A realistic 2-a-week commitment with one missed session last week: strong but not perfect regularity.
	const lastMonday = addDays(mondayOf(today), -7);
	const missed = state.history.find((l) => l.date >= lastMonday && l.date < mondayOf(today));
	state = { ...dropLogs(state, (l) => l.id !== missed?.id), weeklyGoal: 2 };
	const { history: h, ctx, level } = progressOf(state, today);
	const earned = badges(h, ctx)
		.filter((b) => b.unlocked)
		.map((b) => b.id);
	const lastTwo = earned.slice(-2);
	const createdAt = `${today}T08:00:00.000Z`;
	const ev = (id: string, kind: "badge" | "level" | "report", refId: string) => ({ id, kind, refId, createdAt, seenAt: null });
	const progressEvents = [...lastTwo.map((id) => ev(`badge:${id}`, "badge", id)), ev(`level:${level.level}`, "level", String(level.level)), ev(`report:${addDays(mondayOf(today), -7)}`, "report", addDays(mondayOf(today), -7))];
	// Synthetic (illustrated, demo) check-in photos at the start and end of the 12-week history, for AI photo analysis testing.
	const weights = state.bodyWeights;
	const nearest = (date: ISODate) => weights.reduce<{ date: string; kg: number } | undefined>((best, w) => (!best || Math.abs(Date.parse(w.date) - Date.parse(date)) < Math.abs(Date.parse(best.date) - Date.parse(date)) ? w : best), undefined)?.kg;
	const firstDate = addDays(today, -7 * 12 + 3);
	const lastDate = addDays(today, -3);
	const photos = [
		{ id: "demo-photo-before", date: firstDate, dataUrl: DEMO_PHOTO_BEFORE, weightKg: nearest(firstDate) },
		{ id: "demo-photo-after", date: lastDate, dataUrl: DEMO_PHOTO_AFTER, weightKg: nearest(lastDate) },
	];
	return { ...state, progressEvents, photos };
}

export function scenarioState(id: ScenarioId, today: ISODate, opts: { premium?: boolean } = {}): FitState {
	const monday = mondayOf(today);
	let state: FitState;
	switch (id) {
		case "S0":
			state = base(today, "metric", false);
			break;
		case "S1": {
			state = base(today, "metric", true);
			const thisWeek = state.history.filter((l) => l.date >= monday && l.date <= today).slice(0, 2);
			const keep = new Set(thisWeek.map((l) => l.id));
			state = dropLogs(state, (l) => keep.has(l.id));
			state = {
				...state,
				planned: state.planned.filter((w) => w.date >= monday),
				bodyWeights: state.bodyWeights.slice(-1),
				pauses: [],
				unlocked: {},
				water: {},
			};
			break;
		}
		case "S2":
			state = s2(today);
			break;
		case "S3":
			state = { ...s2(today), pauses: [...base(today, "metric", true).pauses, { from: monday, to: addDays(monday, 6) }] };
			break;
		case "S4": {
			state = base(today, "metric", true);
			const latest = state.history[state.history.length - 1];
			state = dropLogs(state, (l) => l.date < addDays(monday, -21));
			const yesterday = addDays(today, -1);
			const comeback: SessionLog | undefined = latest && { ...latest, id: "h-comeback", plannedId: null, date: yesterday };
			state = { ...state, history: comeback ? [...state.history, comeback] : state.history, progressEvents: [] };
			break;
		}
		case "S5": {
			state = { ...base(today, "imperial", true) };
			const bodyweight = (exerciseId: string) => getExercise(exerciseId).kind === "bodyweight";
			// Reps and hold times creep up every few sessions so rep/time records exist.
			const trimmed = state.history.map((l, i) => ({
				...l,
				exercises: l.exercises.filter((e) => bodyweight(e.exerciseId)).map((e) => ({ ...e, sets: e.sets.map(({ reps }) => ({ reps: reps + Math.floor(i / 6) * (getExercise(e.exerciseId).timed ? 5 : 1) })) })),
				prs: [],
			}));
			state = { ...state, history: trimmed };
			state = dropLogs(state, (l) => l.exercises.length > 0);
			break;
		}
		case "S6":
			state = s2(today);
			state = { ...state, subscription: { tier: opts.premium ? "premium" : "free", trialEndsAt: null } };
			break;
	}
	return { ...state, progressToken: TOKENS[id] };
}
