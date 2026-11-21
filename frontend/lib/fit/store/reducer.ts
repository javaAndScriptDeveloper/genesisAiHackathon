import { fromRemote, type RemoteSnapshot } from "../../api/progressSync";
import { daysBetween, toISO, type ISODate } from "../dates";
import { MAX_PAUSE_DAYS } from "../../progress/consistency";
import type { Units } from "../units";
import { findExercise, getExercise } from "../exercises";
import { applyAdapt, replaceBlock, replaceUnavailable } from "../adapt";
import { ACCEPT_DELAY_MS, MAX_CHAT_MESSAGES } from "../community";
import { deriveNotifications } from "../notifications";
import { buildAdHocWorkout, estimateMinutes, generatePlan, nextUpcoming } from "../plan";
import { defaultWeeklyGoal, emptyState, newProgressToken, seedHistory, WATER_MAX_ML } from "../seed";
import type { ArchiveItem, ProgressEvent } from "../../progress/types";
import { applyProgression, detectPrs, mean, volumeOf } from "../stats";
import { detectEvents, reportReadyEvent } from "../../progress/events";
import { historyFromFit } from "../../progress/fromFit";
import { xpForSession } from "../../progress/xp";
import { t } from "../../messages";
import { progressCtx, progressOf } from "./progressStats";
import type {
	ActiveSession,
	AdaptOp,
	AppNotification,
	ChatMessage,
	Goal,
	CoachAction,
	CoachMessage,
	Equipment,
	ExerciseBlock,
	FitState,
	Limitation,
	MealSlot,
	NotificationKind,
	NotificationSettings,
	Perceived,
	PhotoCheckIn,
	PhotoInsight,
	PlannedWorkout,
	Profile,
	SessionLog,
	SkipReason,
} from "../types";

export type Action =
	| { type: "hydrate"; state: FitState }
	| { type: "reset" }
	| { type: "complete-onboarding"; profile: Profile; units: Units; demoHistory: boolean; today: ISODate; now: string; trainerId?: string; /** A plan built before dispatch (the AI plan from onboarding); otherwise the rule-based one. */ planned?: PlannedWorkout[] }
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
	| { type: "photo-ai-consent"; at: string }
	| { type: "add-photo-insight"; insight: PhotoInsight }
	| { type: "remove-photo"; id: string }
	| { type: "add-body-weight"; date: ISODate; kg: number; at?: string }
	| { type: "partner"; id: string; status: "invited" | "accepted" | null; now?: string }
	| { type: "partners-sync"; now: string }
	| { type: "chat-send"; buddyId: string; message: ChatMessage }
	| { type: "joint-workout"; workoutId: string; partnerId: string | null }
	| { type: "clear-demo-history"; today: ISODate }
	| { type: "add-pause"; from: ISODate; to: ISODate }
	| { type: "remove-pause"; from: ISODate }
	| { type: "set-weekly-goal"; goal: number }
	| { type: "record-events"; events: ProgressEvent[] }
	| { type: "mark-seen"; kinds?: ProgressEvent["kind"][]; ids?: string[]; now: string }
	| { type: "archive-queued"; items: ArchiveItem[] }
	| { type: "archive-sent"; ids: string[]; weeks: string[] }
	| { type: "apply-remote"; snapshot: RemoteSnapshot };

/** The queue never holds more than this many items; overflow drops the oldest "change" items, never "weekly". */
export const ARCHIVE_QUEUE_CAP = 50;

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

/** State with a finished session applied: log appended, its planned workout closed, progression pushed forward. */
function withLog(state: FitState, a: ActiveSession, log: SessionLog, today: ISODate): FitState {
	let planned = state.planned;
	if (a.plannedId) planned = planned.map((w) => (w.id === a.plannedId ? { ...w, status: log.status, logId: log.id, exercises: a.exercises } : w));
	planned = applyProgression(planned, log, today);
	return { ...state, history: [...state.history, log], planned };
}

export function previewLog(state: FitState, a: ActiveSession, today: ISODate): SessionLog {
	const exercises = a.exercises.map((b) => ({
		exerciseId: b.exerciseId,
		skipped: !!b.skipped || b.sets.every((s) => !s.done),
		sets: b.sets.filter((s) => s.done).map((s) => ({ reps: s.reps ?? s.target, weight: s.weight })),
	}));
	const status = allDone(a.exercises) ? "completed" : "partial";
	const prs = detectPrs(state.history, exercises);
	const log: SessionLog = {
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
		xp: 0,
		prs,
	};
	// XP is the engine's (lib/progress): what this session adds once it is in the history. A same-week early start is
	// dated on its planned day, so read it as of that day (the engine only counts sessions up to "today").
	const plannedDate = a.plannedId ? state.planned.find((w) => w.id === a.plannedId)?.date : undefined;
	const asOf = plannedDate !== undefined && plannedDate > today ? plannedDate : today;
	const after = historyFromFit(withLog(state, a, log, today), asOf);
	return { ...log, xp: xpForSession(after, progressCtx(state), log.id).total };
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

function rebuildUpcoming(state: FitState, profile: Profile, today: ISODate): FitState {
	const kept = state.planned.filter((w) => w.status !== "planned" || w.date < today || w.adHoc);
	const keptIds = new Set(kept.map((w) => w.id));
	let upcoming = generatePlan(profile, today, 4).filter((w) => !keptIds.has(w.id));
	for (const log of [...state.history].sort((a, b) => a.date.localeCompare(b.date))) upcoming = applyProgression(upcoming, log, today);
	return { ...state, profile, planned: [...kept, ...upcoming].sort((a, b) => a.date.localeCompare(b.date)) };
}

/**
 * New badges, level-ups and records between two states, recorded as progress events in the same step
 * (the engine is the only judge; legacy `state.unlocked` / `state.celebrate` are no longer written).
 */
function recordProgress(before: FitState, after: FitState, today: ISODate, now: string): FitState {
	return recordEvents(after, detectEvents(progressOf(before, today), progressOf(after, today), now), now);
}

/** Records events not seen before (by id) and announces new badges/levels in the notification list. */
function recordEvents(state: FitState, events: ProgressEvent[], now: string): FitState {
	const have = new Set(state.progressEvents.map((e) => e.id));
	const fresh = events.filter((e) => !have.has(e.id));
	if (fresh.length === 0) return state;
	const next = reducer(state, { type: "record-events", events: fresh });
	if (!state.notificationSettings.enabled.achievement) return next;
	const notes = fresh.flatMap((e): AppNotification[] => {
		if (e.kind === "badge") return [{ id: `n-badge-${e.refId}`, kind: "achievement", title: t("fit.progress.notify.badgeTitle", { title: t(`fit.progress.badge.${e.refId}.title`) }), body: t(`fit.progress.badge.${e.refId}.desc`), createdAt: now, read: false, href: "/progress" }];
		if (e.kind === "level") return [{ id: `n-level-${e.refId}`, kind: "achievement", title: t("fit.progress.notify.levelTitle", { level: e.refId }), body: t("fit.progress.notify.levelBody"), createdAt: now, read: false, href: "/progress" }];
		return [];
	});
	return appendNotifications(next, notes);
}

function finishSession(state: FitState, today: ISODate, now: string): FitState {
	const a = state.active;
	if (!a || a.phase !== "summary") return state;
	if (a.outcome === "empty") return { ...state, active: null };
	const log = previewLog(state, a, today);
	let next: FitState = { ...withLog(state, a, log, today), active: null };
	next = recordProgress(state, next, today, now);
	return appendNotifications(next, deriveNotifications(next, new Date(now)));
}

export function reducer(state: FitState, action: Action): FitState {
	switch (action.type) {
		case "hydrate":
			// Older saved state has no pauses yet.
			// Older saved state also lacks the progress fields.
			return {
				...emptyState(),
				...action.state,
				pauses: action.state.pauses ?? [],
				progressToken: action.state.progressToken ?? newProgressToken(),
				weeklyGoal: action.state.weeklyGoal ?? defaultWeeklyGoal(action.state.profile ?? null),
				progressEvents: action.state.progressEvents ?? [],
				// Old saves start diffing from today, so badges they already hold are never announced retroactively.
				lastProgressDay: action.state.lastProgressDay ?? toISO(new Date()),
				archivedWeeks: action.state.archivedWeeks ?? [],
				archiveQueue: action.state.archiveQueue ?? [],
				photoInsights: action.state.photoInsights ?? [],
				photoAiConsentAt: action.state.photoAiConsentAt ?? null,
			};
		case "reset":
			return emptyState();
		case "complete-onboarding": {
			const base: FitState = { ...emptyState(), units: action.units, trainerId: action.trainerId ?? null, profile: action.profile, notificationSettings: state.notificationSettings, bodyWeights: [{ date: action.today, kg: action.profile.weightKg }], weeklyGoal: defaultWeeklyGoal(action.profile) };
			const devices = { apple: action.profile.wearable === "apple", garmin: action.profile.wearable === "garmin" };
			if (action.demoHistory) {
				const seeded = seedHistory(action.profile, action.today);
				const { futureFrom: _unused, ...rest } = seeded;
				void _unused;
				// Demo history fills the past; the user's own plan, when given, owns everything from today on.
				const planned = action.planned ? [...rest.planned.filter((w) => w.date < action.today), ...action.planned] : rest.planned;
				let s: FitState = { ...base, ...rest, planned, devices };
				s = appendNotifications(s, [{ id: "n-welcome", kind: "coach", title: "Your plan is ready", body: "I built it from your goal, schedule and equipment. Ask me to adjust anything.", createdAt: action.now, read: false, href: "/coach" }]);
				return appendNotifications(s, deriveNotifications(s, new Date(action.now)));
			}
			const planned = action.planned ?? generatePlan(action.profile, action.today, 4);
			let s: FitState = { ...base, planned, devices };
			s = appendNotifications(s, [{ id: "n-welcome", kind: "coach", title: "Your plan is ready", body: "I built it from your goal, schedule and equipment. Ask me to adjust anything.", createdAt: action.now, read: false, href: "/coach" }]);
			return appendNotifications(s, deriveNotifications(s, new Date(action.now)));
		}
		case "update-profile": {
			const devices = { apple: action.profile.wearable === "apple" ? true : state.devices.apple && action.profile.wearable === "none" ? state.devices.apple : state.devices.apple, garmin: state.devices.garmin };
			// The preferences form does not carry the free-text goal; keep it unless the preset goal changed.
			const prev = state.profile;
			const profile = action.profile.goalText === undefined && prev?.goalText && prev.goal === action.profile.goal ? { ...action.profile, goalText: prev.goalText } : action.profile;
			return rebuildUpcoming({ ...state, devices, units: action.units }, profile, action.today);
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
		case "sync": {
			if (!state.profile) return state;
			const day = toISO(new Date(action.now));
			let s = appendNotifications(state, deriveNotifications(state, new Date(action.now)));
			// Day/week rollover: a finished week can credit a perfect week, week XP or rest XP (new badges, levels).
			// Diff the snapshot of the last synced day against today's; event ids make repeats harmless.
			const last = state.lastProgressDay;
			if (last !== null && last < day) s = recordEvents(s, detectEvents(progressOf(state, last), progressOf(state, day), action.now), action.now);
			if (last !== day) s = { ...s, lastProgressDay: day };
			// From Monday on, last week's report is "new" until opened. Ids are per week, so this never duplicates.
			const report = reportReadyEvent(historyFromFit(state, day), progressCtx(state), action.now);
			return report ? reducer(s, { type: "record-events", events: [report] }) : s;
		}
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
			return patchPlanned(state, action.id, (w) => ({ ...w, status: "skipped", skipReason: action.reason }));
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
			return { ...next, coach: [...coach, action.reply].slice(-80) };
		}
		case "notification-read":
			return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };
		case "notifications-read-all":
			return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
		case "notification-settings":
			return { ...state, notificationSettings: action.settings };
		case "water": {
			const current = state.water[action.date] ?? 0;
			return { ...state, water: { ...state.water, [action.date]: Math.max(0, Math.min(Math.max(current, WATER_MAX_ML), current + action.delta)) } };
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
		case "photo-ai-consent":
			return { ...state, photoAiConsentAt: action.at };
		case "add-photo-insight":
			return state.photoInsights.some((i) => i.id === action.insight.id) ? state : { ...state, photoInsights: [action.insight, ...state.photoInsights] };
		case "remove-photo":
			return { ...state, photos: state.photos.filter((p) => p.id !== action.id) };
		case "add-body-weight":
			return { ...state, bodyWeights: [...state.bodyWeights.filter((b) => b.date !== action.date), { date: action.date, kg: action.kg, at: action.at }].sort((a, b) => a.date.localeCompare(b.date)) };
		case "partner": {
			const partners = { ...state.partners };
			const partnerInvitedAt = { ...state.partnerInvitedAt };
			const chats = { ...state.chats };
			if (action.status === null) {
				delete partners[action.id];
				delete partnerInvitedAt[action.id];
				delete chats[action.id];
			} else {
				partners[action.id] = action.status;
				if (action.status === "invited" && action.now) partnerInvitedAt[action.id] = action.now;
			}
			return { ...state, partners, partnerInvitedAt, chats };
		}
		case "partners-sync": {
			const now = Date.parse(action.now);
			// A missing invite time (requests saved by the old Gym Bro screen) counts as overdue.
			const due = Object.entries(state.partners).filter(([id, status]) => status === "invited" && (state.partnerInvitedAt[id] === undefined || now - Date.parse(state.partnerInvitedAt[id]) >= ACCEPT_DELAY_MS));
			if (due.length === 0) return state;
			return { ...state, partners: { ...state.partners, ...Object.fromEntries(due.map(([id]) => [id, "accepted" as const])) } };
		}
		case "chat-send": {
			const { message, buddyId } = action;
			if (message.text.trim() === "" && !message.photo) return state;
			return { ...state, chats: { ...state.chats, [buddyId]: [...(state.chats[buddyId] ?? []), message].slice(-MAX_CHAT_MESSAGES) } };
		}
		case "joint-workout":
			return patchPlanned(state, action.workoutId, (w) => ({ ...w, partnerId: action.partnerId ?? undefined }));
		case "clear-demo-history": {
			const keepLogs = state.history.filter((l) => !l.demo);
			const keepIds = new Set(keepLogs.map((l) => l.id));
			const planned = state.planned.filter((w) => w.date >= action.today || (w.logId && keepIds.has(w.logId)));
			const unlocked = Object.fromEntries(Object.entries(state.unlocked).filter(([id]) => keepLogs.length > 0 && id !== "none"));
			return { ...state, history: keepLogs, planned, hasDemoHistory: false, unlocked: keepLogs.length ? unlocked : {}, bodyWeights: state.bodyWeights.slice(-1), water: {} };
		}
		case "add-pause": {
			const pauses = state.pauses ?? [];
			const len = daysBetween(action.from, action.to);
			// 1 day … 4 weeks (to − from ≤ 27), never overlapping an existing pause.
			if (len < 0 || len > MAX_PAUSE_DAYS) return state;
			if (pauses.some((p) => p.from <= action.to && p.to >= action.from)) return state;
			return { ...state, pauses: [...pauses, { from: action.from, to: action.to }].sort((a, b) => a.from.localeCompare(b.from)) };
		}
		case "set-weekly-goal":
			return { ...state, weeklyGoal: Math.min(5, Math.max(2, Math.round(action.goal))) };
		case "record-events": {
			const have = new Set(state.progressEvents.map((e) => e.id));
			const fresh: ProgressEvent[] = [];
			for (const e of action.events) {
				if (have.has(e.id)) continue;
				have.add(e.id);
				fresh.push(e);
			}
			return fresh.length === 0 ? state : { ...state, progressEvents: [...state.progressEvents, ...fresh] };
		}
		case "mark-seen": {
			const match = (e: ProgressEvent) => (action.kinds?.includes(e.kind) ?? false) || (action.ids?.includes(e.id) ?? false);
			if (!state.progressEvents.some((e) => e.seenAt === null && match(e))) return state;
			return { ...state, progressEvents: state.progressEvents.map((e) => (e.seenAt === null && match(e) ? { ...e, seenAt: action.now } : e)) };
		}
		case "archive-queued": {
			let queue = [...state.archiveQueue, ...action.items];
			let over = queue.length - ARCHIVE_QUEUE_CAP;
			if (over > 0) {
				// Drop the oldest "change" items first (queue order is oldest first); weekly reports are never dropped.
				queue = queue.filter((it) => {
					if (over > 0 && it.period === "change") {
						over -= 1;
						return false;
					}
					return true;
				});
			}
			return { ...state, archiveQueue: queue };
		}
		case "archive-sent": {
			const sent = new Set(action.ids);
			return { ...state, archiveQueue: state.archiveQueue.filter((it) => !sent.has(it.id)), archivedWeeks: [...new Set([...state.archivedWeeks, ...action.weeks])] };
		}
		case "apply-remote": {
			// Only fills what is empty locally; never overwrites local data.
			const r = fromRemote(action.snapshot);
			const freshDevice = state.history.length === 0;
			const have = new Set(state.progressEvents.map((e) => e.id));
			const events = (r.progressEvents ?? []).filter((e) => !have.has(e.id));
			return {
				...state,
				history: freshDevice && r.history ? r.history : state.history,
				weeklyGoal: freshDevice && r.weeklyGoal !== undefined ? r.weeklyGoal : state.weeklyGoal,
				pauses: state.pauses.length === 0 && r.pauses ? r.pauses : state.pauses,
				bodyWeights: state.bodyWeights.length === 0 && r.bodyWeights ? r.bodyWeights : state.bodyWeights,
				goalWeightKg: state.goalWeightKg === null && r.goalWeightKg != null ? r.goalWeightKg : state.goalWeightKg,
				goalSetAt: state.goalWeightKg === null && r.goalWeightKg != null ? r.goalSetAt ?? null : state.goalSetAt,
				progressEvents: events.length ? [...state.progressEvents, ...events] : state.progressEvents,
			};
		}
		case "remove-pause": {
			const pauses = state.pauses ?? [];
			if (!pauses.some((p) => p.from === action.from)) return state;
			return { ...state, pauses: pauses.filter((p) => p.from !== action.from) };
		}
	}
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

export { findExercise };
