import { toISO, type ISODate } from "../dates";
import type { Units } from "../units";
import { findExercise, getExercise } from "../exercises";
import { applyAdapt, replaceBlock, replaceUnavailable } from "../adapt";
import { evaluateAchievements, achievementById, totalXp } from "../gamification";
import { deriveNotifications } from "../notifications";
import { buildAdHocWorkout, estimateMinutes, generatePlan, nextUpcoming } from "../plan";
import { emptyState, seedHistory } from "../seed";
import { applyProgression, detectPrs, mean, sessionXp, volumeOf, weekStats } from "../stats";
import type {
	ActiveSession,
	AdaptOp,
	AppNotification,
	Goal,
	CoachAction,
	CoachMessage,
	DailyCheck,
	Equipment,
	ExerciseBlock,
	FitState,
	Limitation,
	MealSlot,
	NotificationKind,
	NotificationSettings,
	Perceived,
	PhotoCheckIn,
	PlannedWorkout,
	Profile,
	SessionLog,
	SkipReason,
} from "../types";

type Backend = { userId: number; deviceId: number };

export type Action =
	| { type: "hydrate"; state: FitState }
	| { type: "reset" }
	| { type: "set-backend"; backend: Backend }
	| { type: "apply-ai-plan"; planned: PlannedWorkout[]; summary: string; source: "ai" | "fallback"; wishes: string[]; today: ISODate }
	| { type: "apply-daily"; check: Omit<DailyCheck, "original" | "undone">; session: PlannedWorkout | null }
	| { type: "undo-daily" }
	| { type: "complete-onboarding"; profile: Profile; units: Units; demoHistory: boolean; today: ISODate; now: string; ai?: { backend: Backend | null; planned: PlannedWorkout[]; summary: string; source: "ai" | "fallback" } }
	| { type: "update-profile"; profile: Profile; units: Units; today: ISODate }
	| { type: "set-goal"; goal: Goal; goalText: string; today: ISODate }
	| { type: "set-trainer"; trainerId: string }
	| { type: "set-units"; units: Units }
	| { type: "set-goal-weight"; kg: number | null; at?: string }
	| { type: "sync"; now: string }
	| { type: "start-workout"; plannedId: string; now: string }
	| { type: "restart-workout" }
	| { type: "go-to"; index: number }
	| { type: "log-set"; reps: number; weight?: number }
	| { type: "start-timed" }
	| { type: "tick" }
	| { type: "hr"; bpm: number }
	| { type: "skip-rest" }
	| { type: "add-rest"; seconds: number }
	| { type: "pause" }
	| { type: "resume" }
	| { type: "skip-exercise"; blockId: string }
	| { type: "adapt"; op: AdaptOp; today: ISODate }
	| { type: "replace-exercise"; blockId: string; exerciseId: string; today: ISODate }
	| { type: "safety-stop" }
	| { type: "end-early" }
	| { type: "set-perceived"; value: Perceived }
	| { type: "finish"; today: ISODate; now: string }
	| { type: "discard-active" }
	| { type: "skip-planned"; id: string; reason: SkipReason }
	| { type: "move-planned"; id: string; date: ISODate }
	| { type: "adapt-planned"; id: string; op: AdaptOp; today: ISODate }
	| { type: "replace-planned-exercise"; id: string; blockId: string; exerciseId: string }
	| { type: "add-adhoc"; kind: "mobility" | "cardio"; today: ISODate }
	| { type: "coach-message"; message: CoachMessage }
	| { type: "coach-mark"; messageId: string; appliedAction: string }
	| { type: "coach-apply"; messageId: string; action: CoachAction; today: ISODate; now: string; reply: CoachMessage }
	| { type: "notification-read"; id: string }
	| { type: "notifications-read-all" }
	| { type: "notification-settings"; settings: NotificationSettings }
	| { type: "water"; date: ISODate; delta: number }
	| { type: "water-goal"; ml: number }
	| { type: "toggle-meal"; date: ISODate; slot: MealSlot }
	| { type: "start-trial"; now: string }
	| { type: "end-premium" }
	| { type: "device"; id: "apple" | "garmin"; connected: boolean }
	| { type: "add-bp"; systolic: number; diastolic: number; now: string }
	| { type: "remove-bp"; id: string }
	| { type: "add-photo"; photo: PhotoCheckIn }
	| { type: "remove-photo"; id: string }
	| { type: "add-body-weight"; date: ISODate; kg: number; at?: string }
	| { type: "partner"; id: string; status: "invited" | "accepted" | null }
	| { type: "joint-workout"; workoutId: string; partnerId: string | null }
	| { type: "dismiss-celebration" }
	| { type: "clear-demo-history"; today: ISODate };

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function patchPlanned(state: FitState, id: string, patch: (w: PlannedWorkout) => PlannedWorkout): FitState {
	return { ...state, planned: state.planned.map((w) => (w.id === id ? patch(w) : w)) };
}

function appendNotifications(state: FitState, incoming: AppNotification[]): FitState {
	const seen = new Set(state.notifications.map((n) => n.id));
	const fresh = incoming.filter((n) => !seen.has(n.id));
	if (fresh.length === 0) return state;
	return { ...state, notifications: [...fresh, ...state.notifications].slice(0, 60) };
}

function firstTodoIndex(blocks: ExerciseBlock[], from = 0): number {
	const i = blocks.findIndex((b, n) => n >= from && !b.skipped && b.sets.some((s) => !s.done));
	return i;
}

function nextIndexAfter(blocks: ExerciseBlock[], current: number): number {
	const forward = firstTodoIndex(blocks, current);
	return forward >= 0 ? forward : firstTodoIndex(blocks, 0);
}

function allDone(blocks: ExerciseBlock[]): boolean {
	return blocks.every((b) => b.skipped || b.sets.every((s) => s.done));
}

function setsDone(blocks: ExerciseBlock[]): number {
	return blocks.reduce((n, b) => n + b.sets.filter((s) => s.done).length, 0);
}

function withActive(state: FitState, fn: (a: ActiveSession) => ActiveSession): FitState {
	return state.active ? { ...state, active: fn(state.active) } : state;
}

function enterSummary(a: ActiveSession): ActiveSession {
	const done = allDone(a.exercises);
	return { ...a, phase: "summary", paused: false, workLeft: null, restLeft: 0, outcome: setsDone(a.exercises) === 0 ? "empty" : done ? "completed" : "partial" };
}

/** Moves to the next exercise that still has work, or to the summary when everything is finished. */
function advanceAfterRest(a: ActiveSession): ActiveSession {
	if (allDone(a.exercises)) return enterSummary(a);
	const current = a.exercises[a.index];
	const stay = current && !current.skipped && current.sets.some((s) => !s.done);
	return { ...a, phase: "work", restLeft: 0, index: stay ? a.index : Math.max(0, nextIndexAfter(a.exercises, a.index)) };
}

export function previewLog(state: FitState, a: ActiveSession, today: ISODate): SessionLog {
	const exercises = a.exercises.map((b) => ({
		exerciseId: b.exerciseId,
		skipped: !!b.skipped || b.sets.every((s) => !s.done),
		sets: b.sets.filter((s) => s.done).map((s) => ({ reps: s.reps ?? s.target, weight: s.weight })),
	}));
	const status = allDone(a.exercises) ? "completed" : "partial";
	const prs = detectPrs(state.history, exercises);
	const planned = a.plannedId ? state.planned.find((w) => w.id === a.plannedId) : undefined;
	const extra = !!planned?.adHoc && weekStats(state.planned, state.history, today).remaining === 0;
	return {
		id: `l-${a.id}`,
		plannedId: a.plannedId,
		date: today,
		title: a.title,
		durationSec: a.elapsedSec,
		status,
		exercises,
		volumeKg: volumeOf(exercises),
		perceived: a.perceived ?? "right",
		adaptations: a.adaptations,
		avgHr: a.hrSamples.length ? Math.round(mean(a.hrSamples)) : undefined,
		hrDemo: a.hrSamples.length ? true : undefined,
		xp: sessionXp({ status, durationSec: a.elapsedSec, prs: prs.length, adHocExtra: !!planned?.adHoc && extra }),
		prs,
	};
}

function adaptTarget(state: FitState, op: AdaptOp, today: ISODate): { state: FitState; message: string; changed: boolean } {
	const profile = state.profile;
	if (!profile) return { state, message: "Set up your profile first.", changed: false };
	if (state.active && state.active.phase !== "summary") {
		const a = state.active;
		const res = applyAdapt(a.exercises, op, { profile, startIndex: a.index });
		if (!res.changed) return { state, message: res.message, changed: false };
		let restLeft = a.restLeft;
		if (op.kind === "more-rest" && a.phase === "rest") restLeft += 30;
		const exercises = res.exercises;
		const index = Math.min(a.index, Math.max(0, exercises.length - 1));
		return { state: { ...state, active: { ...a, exercises, index, restLeft, adaptations: [...a.adaptations, res.message] } }, message: res.message, changed: true };
	}
	const target = nextUpcoming(state.planned, today);
	if (!target) return { state, message: "No upcoming workout to adjust.", changed: false };
	const res = applyAdapt(target.exercises, op, { profile, startIndex: 0 });
	if (!res.changed) return { state, message: res.message, changed: false };
	return { state: patchPlanned(state, target.id, (w) => ({ ...w, exercises: res.exercises, durationMin: estimateMinutes(res.exercises) })), message: `${target.title}: ${res.message}`, changed: true };
}

/** Replaces the still-planned future sessions with `incoming`; history, finished, past and ad-hoc sessions stay. */
function mergeUpcoming(state: FitState, incoming: PlannedWorkout[], today: ISODate): FitState {
	const kept = state.planned.filter((w) => w.status !== "planned" || w.date < today || w.adHoc);
	const keptIds = new Set(kept.map((w) => w.id));
	let upcoming = incoming.filter((w) => !keptIds.has(w.id));
	for (const log of [...state.history].sort((a, b) => a.date.localeCompare(b.date))) upcoming = applyProgression(upcoming, log, today);
	return { ...state, planned: [...kept, ...upcoming].sort((a, b) => a.date.localeCompare(b.date)) };
}

function rebuildUpcoming(state: FitState, profile: Profile, today: ISODate): FitState {
	return { ...mergeUpcoming(state, generatePlan(profile, today, 4), today), profile };
}

function unlockNew(state: FitState, today: ISODate, now: string): FitState {
	const ids = evaluateAchievements(state, today);
	if (ids.length === 0) return state;
	const unlocked = { ...state.unlocked, ...Object.fromEntries(ids.map((id) => [id, today])) };
	const notes: AppNotification[] = ids.flatMap((id) => {
		const def = achievementById(id);
		if (!def || !state.notificationSettings.enabled.achievement) return [];
		return [{ id: `n-ach-${id}`, kind: "achievement" as NotificationKind, title: `Unlocked: ${def.title}`, body: `${def.description} +${def.xp} XP`, createdAt: now, read: false, href: "/progress" }];
	});
	return appendNotifications({ ...state, unlocked, celebrate: [...state.celebrate, ...ids] }, notes);
}

function finishSession(state: FitState, today: ISODate, now: string): FitState {
	const a = state.active;
	if (!a || a.phase !== "summary") return state;
	if (a.outcome === "empty") return { ...state, active: null };
	const log = previewLog(state, a, today);
	const history = [...state.history, log];
	let planned = state.planned;
	if (a.plannedId) planned = planned.map((w) => (w.id === a.plannedId ? { ...w, status: log.status, logId: log.id, exercises: a.exercises } : w));
	planned = applyProgression(planned, log, today);
	let next: FitState = { ...state, history, planned, active: null };
	next = unlockNew(next, today, now);
	return appendNotifications(next, deriveNotifications(next, new Date(now)));
}

export function reducer(state: FitState, action: Action): FitState {
	switch (action.type) {
		case "hydrate":
			return action.state;
		case "reset":
			return emptyState();
		case "complete-onboarding": {
			const base: FitState = { ...emptyState(), units: action.units, profile: action.profile, notificationSettings: state.notificationSettings, bodyWeights: [{ date: action.today, kg: action.profile.weightKg }] };
			const devices = { apple: action.profile.wearable === "apple", garmin: action.profile.wearable === "garmin" };
			if (action.demoHistory) {
				const seeded = seedHistory(action.profile, action.today);
				const { futureFrom: _unused, ...rest } = seeded;
				void _unused;
				let s: FitState = { ...base, ...rest, devices };
				s = appendNotifications(s, [{ id: "n-welcome", kind: "coach", title: "Your plan is ready", body: "I built it from your goal, schedule and equipment. Ask me to adjust anything.", createdAt: action.now, read: false, href: "/coach" }]);
				return finishOnboarding(s, action);
			}
			const planned = generatePlan(action.profile, action.today, 4);
			let s: FitState = { ...base, planned, devices };
			s = appendNotifications(s, [{ id: "n-welcome", kind: "coach", title: "Your plan is ready", body: "I built it from your goal, schedule and equipment. Ask me to adjust anything.", createdAt: action.now, read: false, href: "/coach" }]);
			return finishOnboarding(s, action);
		}
		case "set-backend":
			return { ...state, backend: action.backend };
		case "apply-ai-plan":
			return { ...mergeUpcoming(state, action.planned, action.today), planSummary: action.summary, planSource: action.source, planWishes: action.wishes, daily: null };
		case "apply-daily": {
			const prev = state.daily;
			const earlier = prev && prev.date === action.check.date && prev.original && !prev.undone ? prev.original : null;
			if (action.check.status === "unchanged" && earlier) {
				const back = earlier;
				return { ...state, planned: state.planned.map((w) => (w.id === back.id ? back : w)), daily: { ...action.check, original: null, undone: false } };
			}
			const keep = prev && prev.date === action.check.date && prev.sessionId === action.check.sessionId && prev.original && !prev.undone ? prev.original : null;
			const original = keep ?? (action.session ? (state.planned.find((w) => w.id === action.session?.id) ?? null) : null);
			const session = action.session;
			const planned = session && original ? state.planned.map((w) => (w.id === session.id ? session : w)) : state.planned;
			return { ...state, planned, daily: { ...action.check, original, undone: false } };
		}
		case "undo-daily": {
			const original = state.daily?.original;
			if (!state.daily || !original || state.daily.undone) return state;
			return { ...state, planned: state.planned.map((w) => (w.id === original.id ? original : w)), daily: { ...state.daily, undone: true } };
		}
		case "update-profile": {
			const devices = { apple: action.profile.wearable === "apple" ? true : state.devices.apple && action.profile.wearable === "none" ? state.devices.apple : state.devices.apple, garmin: state.devices.garmin };
			// The preferences form does not carry the free-text goal; keep it unless the preset goal changed.
			const prev = state.profile;
			const profile = action.profile.goalText === undefined && prev?.goalText && prev.goal === action.profile.goal ? { ...action.profile, goalText: prev.goalText } : action.profile;
			return rebuildUpcoming({ ...state, devices, units: action.units, planSource: "rules" }, profile, action.today);
		}
		case "set-goal-weight":
			return { ...state, goalWeightKg: action.kg, goalSetAt: action.kg === null ? null : (action.at ?? null) };
		case "set-units": {
			return { ...state, units: action.units };
		}
		case "set-goal":
			return state.profile ? reducer(state, { type: "update-profile", profile: { ...state.profile, goal: action.goal, goalText: action.goalText }, units: state.units, today: action.today }) : state;
		case "set-trainer":
			return { ...state, trainerId: action.trainerId };
		case "sync":
			return state.profile ? appendNotifications(state, deriveNotifications(state, new Date(action.now))) : state;
		case "start-workout": {
			const w = state.planned.find((p) => p.id === action.plannedId);
			if (!w) return state;
			const exercises = w.exercises.map((b) => ({ ...b, sets: b.sets.map((s) => ({ ...s, done: false, reps: undefined, weight: undefined })), skipped: false }));
			const active: ActiveSession = {
				id: uid("s"),
				plannedId: w.id,
				title: w.title,
				startedAt: action.now,
				exercises,
				index: Math.max(0, firstTodoIndex(exercises)),
				phase: "work",
				paused: false,
				elapsedSec: 0,
				restLeft: 0,
				restTotal: 0,
				workLeft: null,
				adaptations: [],
				safetyStop: false,
				hrSamples: [],
				outcome: null,
				perceived: null,
			};
			return { ...state, active };
		}
		case "restart-workout":
			return withActive(state, (a) => {
				const exercises = a.exercises.map((b) => ({ ...b, sets: b.sets.map((s) => ({ ...s, done: false, reps: undefined, weight: undefined })), skipped: false }));
				return { ...a, exercises, index: 0, phase: "work", paused: false, safetyStop: false, elapsedSec: 0, restLeft: 0, restTotal: 0, workLeft: null, hrSamples: [], outcome: null };
			});
		case "go-to":
			return withActive(state, (a) => (a.phase === "summary" ? a : { ...a, index: Math.min(Math.max(0, action.index), a.exercises.length - 1), phase: a.phase === "rest" ? a.phase : "work", workLeft: null }));
		case "log-set":
			return withActive(state, (a) => {
				const block = a.exercises[a.index];
				if (!block || a.phase !== "work") return a;
				const at = block.sets.findIndex((s) => !s.done);
				if (at < 0) return advanceAfterRest(a);
				const exercises = a.exercises.map((b, i) =>
					i === a.index ? { ...b, sets: b.sets.map((s, n) => (n === at ? { ...s, done: true, reps: action.reps, weight: action.weight } : s)) } : b,
				);
				if (allDone(exercises)) return enterSummary({ ...a, exercises });
				return { ...a, exercises, phase: "rest", restTotal: block.restSec, restLeft: block.restSec, workLeft: null };
			});
		case "start-timed":
			return withActive(state, (a) => {
				const block = a.exercises[a.index];
				const set = block?.sets.find((s) => !s.done);
				return set && a.phase === "work" ? { ...a, workLeft: set.target } : a;
			});
		case "tick":
			return withActive(state, (a) => {
				if (a.paused || a.phase === "summary") return a;
				let next: ActiveSession = { ...a, elapsedSec: a.elapsedSec + 1 };
				if (a.phase === "rest") {
					const left = a.restLeft - 1;
					next = left <= 0 ? advanceAfterRest({ ...next, restLeft: 0 }) : { ...next, restLeft: left };
				} else if (a.workLeft !== null) {
					const left = a.workLeft - 1;
					if (left <= 0) {
						const block = a.exercises[a.index];
						const target = block?.sets.find((s) => !s.done)?.target ?? 0;
						return reducer({ ...state, active: { ...next, workLeft: null } }, { type: "log-set", reps: target }).active ?? next;
					}
					next = { ...next, workLeft: left };
				}
				return next;
			});
		case "hr":
			return withActive(state, (a) => (a.paused ? a : { ...a, hrSamples: [...a.hrSamples.slice(-599), action.bpm] }));
		case "skip-rest":
			return withActive(state, (a) => (a.phase === "rest" ? advanceAfterRest(a) : a));
		case "add-rest":
			return withActive(state, (a) => (a.phase === "rest" ? { ...a, restLeft: Math.min(300, a.restLeft + action.seconds), restTotal: Math.min(300, a.restTotal + action.seconds) } : a));
		case "pause":
			return withActive(state, (a) => (a.phase === "summary" ? a : { ...a, paused: true }));
		case "resume":
			return withActive(state, (a) => ({ ...a, paused: false, safetyStop: false }));
		case "skip-exercise":
			return withActive(state, (a) => {
				const exercises = a.exercises.map((b) => (b.id === action.blockId ? { ...b, skipped: true } : b));
				const skippedNote = `Skipped ${getExercise(a.exercises.find((b) => b.id === action.blockId)?.exerciseId ?? a.exercises[0]?.exerciseId ?? "push-up").name}.`;
				const next = { ...a, exercises, adaptations: [...a.adaptations, skippedNote], phase: a.phase === "rest" ? ("work" as const) : a.phase, restLeft: 0, workLeft: null };
				return allDone(exercises) ? enterSummary(next) : { ...next, index: Math.max(0, nextIndexAfter(exercises, a.index)) };
			});
		case "adapt":
			return adaptTarget(state, action.op, action.today).state;
		case "replace-exercise": {
			const profile = state.profile;
			const a = state.active;
			if (!profile || !a) return state;
			const at = a.exercises.findIndex((b) => b.id === action.blockId);
			const res = replaceBlock(a.exercises, at, action.exerciseId, profile);
			if (!res.changed) return state;
			return { ...state, active: { ...a, exercises: res.exercises, adaptations: [...a.adaptations, res.message], phase: a.phase === "rest" ? a.phase : "work", workLeft: null } };
		}
		case "safety-stop":
			return withActive(state, (a) => ({ ...a, paused: true, safetyStop: true, workLeft: null }));
		case "end-early":
			return withActive(state, (a) => enterSummary(a));
		case "set-perceived":
			return withActive(state, (a) => ({ ...a, perceived: action.value }));
		case "finish":
			return finishSession(state, action.today, action.now);
		case "discard-active":
			return { ...state, active: null };
		case "skip-planned":
			return unlockNew(patchPlanned(state, action.id, (w) => ({ ...w, status: "skipped", skipReason: action.reason })), toISO(new Date()), new Date().toISOString());
		case "move-planned": {
			const clash = state.planned.some((w) => w.date === action.date && w.id !== action.id && !w.adHoc);
			if (clash) return state;
			return patchPlanned(state, action.id, (w) => ({ ...w, movedFrom: w.movedFrom ?? w.date, date: action.date }));
		}
		case "adapt-planned": {
			const profile = state.profile;
			const w = state.planned.find((p) => p.id === action.id);
			if (!profile || !w) return state;
			const res = applyAdapt(w.exercises, action.op, { profile, startIndex: 0 });
			return res.changed ? patchPlanned(state, w.id, (p) => ({ ...p, exercises: res.exercises, durationMin: estimateMinutes(res.exercises) })) : state;
		}
		case "replace-planned-exercise": {
			const profile = state.profile;
			const w = state.planned.find((p) => p.id === action.id);
			if (!profile || !w) return state;
			const res = replaceBlock(w.exercises, w.exercises.findIndex((b) => b.id === action.blockId), action.exerciseId, profile);
			return res.changed ? patchPlanned(state, w.id, (p) => ({ ...p, exercises: res.exercises, durationMin: estimateMinutes(res.exercises) })) : state;
		}
		case "add-adhoc": {
			if (!state.profile) return state;
			const existing = state.planned.find((w) => w.id === `x-${action.today}-${action.kind}`);
			if (existing) return state;
			return { ...state, planned: [...state.planned, buildAdHocWorkout(action.kind, action.today, state.profile)].sort((a, b) => a.date.localeCompare(b.date)) };
		}
		case "coach-message":
			return { ...state, coach: [...state.coach, action.message].slice(-80) };
		case "coach-mark":
			return { ...state, coach: state.coach.map((m) => (m.id === action.messageId ? { ...m, appliedAction: action.appliedAction } : m)) };
		case "coach-apply": {
			let next: FitState = state;
			const a = action.action;
			if (a.type === "adapt") next = adaptTarget(state, a.op, action.today).state;
			else if (a.type === "recovery-day") {
				const target = nextUpcoming(state.planned, action.today);
				if (target) next = patchPlanned(state, target.id, (w) => ({ ...w, status: "skipped", skipReason: "recovery" }));
			} else if (a.type === "remove-equipment" && state.profile) {
				next = applyProfileChange(state, { ...state.profile, equipment: state.profile.equipment.filter((e: Equipment) => e !== a.equipment), location: state.profile.location === "gym" ? "hybrid" : state.profile.location }, action.today);
			} else if (a.type === "avoid-limitation" && state.profile) {
				const limitations: Limitation[] = Array.from(new Set([...state.profile.limitations, a.limitation]));
				next = applyProfileChange(state, { ...state.profile, limitations }, action.today);
			} else if (a.type === "rebuild-plan" && state.profile && state.subscription.tier === "premium") {
				next = rebuildUpcoming(state, state.profile, action.today);
			}
			const coach = next.coach.map((m) => (m.id === action.messageId ? { ...m, appliedAction: a.id } : m));
			return unlockNew({ ...next, coach: [...coach, action.reply].slice(-80) }, action.today, action.now);
		}
		case "notification-read":
			return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };
		case "notifications-read-all":
			return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
		case "notification-settings":
			return { ...state, notificationSettings: action.settings };
		case "water": {
			const current = state.water[action.date] ?? 0;
			const next = { ...state, water: { ...state.water, [action.date]: Math.max(0, current + action.delta) } };
			return unlockNew(next, action.date, new Date().toISOString());
		}
		case "water-goal":
			return { ...state, waterGoalMl: Math.max(1000, Math.min(6000, action.ml)) };
		case "toggle-meal": {
			const current = state.meals[action.date] ?? [];
			const meals = current.includes(action.slot) ? current.filter((m) => m !== action.slot) : [...current, action.slot];
			return { ...state, meals: { ...state.meals, [action.date]: meals } };
		}
		case "start-trial":
			return { ...state, subscription: { tier: "premium", trialEndsAt: new Date(new Date(action.now).getTime() + 7 * 86_400_000).toISOString() } };
		case "end-premium":
			return { ...state, subscription: { tier: "free", trialEndsAt: null } };
		case "device":
			return { ...state, devices: { ...state.devices, [action.id]: action.connected } };
		case "add-bp":
			return { ...state, bloodPressure: [{ id: uid("bp"), at: action.now, systolic: action.systolic, diastolic: action.diastolic }, ...state.bloodPressure].slice(0, 30) };
		case "remove-bp":
			return { ...state, bloodPressure: state.bloodPressure.filter((b) => b.id !== action.id) };
		case "add-photo":
			return { ...state, photos: [action.photo, ...state.photos].slice(0, 12) };
		case "remove-photo":
			return { ...state, photos: state.photos.filter((p) => p.id !== action.id) };
		case "add-body-weight":
			return { ...state, bodyWeights: [...state.bodyWeights.filter((b) => b.date !== action.date), { date: action.date, kg: action.kg, at: action.at }].sort((a, b) => a.date.localeCompare(b.date)) };
		case "partner": {
			const partners = { ...state.partners };
			if (action.status === null) delete partners[action.id];
			else partners[action.id] = action.status;
			return { ...state, partners };
		}
		case "joint-workout":
			return patchPlanned(state, action.workoutId, (w) => ({ ...w, partnerId: action.partnerId ?? undefined }));
		case "dismiss-celebration":
			return { ...state, celebrate: [] };
		case "clear-demo-history": {
			const keepLogs = state.history.filter((l) => !l.demo);
			const keepIds = new Set(keepLogs.map((l) => l.id));
			const planned = state.planned.filter((w) => w.date >= action.today || (w.logId && keepIds.has(w.logId)));
			const unlocked = Object.fromEntries(Object.entries(state.unlocked).filter(([id]) => keepLogs.length > 0 && id !== "none"));
			return { ...state, history: keepLogs, planned, hasDemoHistory: false, unlocked: keepLogs.length ? unlocked : {}, bodyWeights: state.bodyWeights.slice(-1), water: {} };
		}
	}
}

function finishOnboarding(state: FitState, action: Extract<Action, { type: "complete-onboarding" }>): FitState {
	const ai = action.ai;
	const next: FitState = ai
		? { ...mergeUpcoming(state, ai.planned, action.today), backend: ai.backend, planSummary: ai.summary, planSource: ai.source }
		: { ...state, planSource: "rules", planSummary: null };
	return appendNotifications(next, deriveNotifications(next, new Date(action.now)));
}

/** Profile changes that affect which exercises are possible: update the profile, then swap what no longer fits. */
function applyProfileChange(state: FitState, profile: Profile, today: ISODate): FitState {
	let planned = state.planned.map((w) => {
		if (w.status !== "planned" || w.date < today) return w;
		const { exercises } = replaceUnavailable(w.exercises, profile);
		return { ...w, exercises, durationMin: estimateMinutes(exercises) };
	});
	let active = state.active;
	if (active && active.phase !== "summary") {
		const { exercises, replaced } = replaceUnavailable(active.exercises, profile);
		if (replaced.length) active = { ...active, exercises, adaptations: [...active.adaptations, `Swapped: ${replaced.join(", ")}`] };
	}
	planned = planned.map((w) => w);
	return { ...state, profile, planned, active };
}

export { findExercise, totalXp };
