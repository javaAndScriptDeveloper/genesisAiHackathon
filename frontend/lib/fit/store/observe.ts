import { track } from "../analytics";
import type { FitState } from "../types";

/** Derives analytics events from state transitions so the reducer and components stay free of tracking calls. */
export function observeTransition(prev: FitState, next: FitState): void {
	if (!prev.profile && next.profile) track("onboarding_completed", { goal: next.profile.goal, daysPerWeek: next.profile.daysPerWeek });
	if (!prev.active && next.active) track("workout_started", { plannedId: next.active.plannedId, exercises: next.active.exercises.length });
	if (prev.active && next.active) {
		if (!prev.active.paused && next.active.paused) track("workout_paused", { elapsedSec: next.active.elapsedSec });
		if (next.active.adaptations.length > prev.active.adaptations.length) track("workout_adapted", { adaptation: next.active.adaptations[next.active.adaptations.length - 1] ?? "" });
		if (!prev.active.safetyStop && next.active.safetyStop) track("workout_abandoned", { setsDone: 0, reason: "safety-stop" });
	}
	if (prev.active && !next.active && next.history.length === prev.history.length) {
		track("workout_abandoned", { setsDone: 0, reason: "discarded" });
	}
	if (next.history.length > prev.history.length) {
		const log = next.history[next.history.length - 1];
		if (log) {
			track("workout_completed", { status: log.status, durationSec: log.durationSec, volumeKg: log.volumeKg, prs: log.prs.length });
			if (log.status === "partial") track("workout_abandoned", { setsDone: log.exercises.reduce((n, e) => n + e.sets.length, 0), reason: "ended-early" });
		}
	}
	for (const id of Object.keys(next.unlocked)) if (!(id in prev.unlocked)) track("achievement_unlocked", { id });
	if (next.coach.filter((m) => m.from === "user").length > prev.coach.filter((m) => m.from === "user").length) track("coach_used", { intent: "message", voice: false });
	if (prev.subscription.tier === "free" && next.subscription.tier === "premium") track("subscription_started", { plan: "premium-trial", demo: true });
}
