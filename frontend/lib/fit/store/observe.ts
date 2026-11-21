import { clearBrowserEvents } from "@/lib/insights/browserEvents";
import { track } from "../analytics";
import type { FitState } from "../types";

/** Derives analytics events from state transitions so the reducer and components stay free of tracking calls. */
export function observeTransition(prev: FitState, next: FitState): void {
	if (prev.profile && !next.profile) {
		clearBrowserEvents();
		return;
	}
	if (!prev.profile && next.profile) track("onboarding_completed", { goal: next.profile.goal, daysPerWeek: next.profile.daysPerWeek });
	if (!prev.active && next.active) track("workout_started", { plannedId: next.active.plannedId, exercises: next.active.exercises.length });
	if (prev.active && next.active) {
		if (!prev.active.paused && next.active.paused) track("workout_paused", { elapsedSec: next.active.elapsedSec });
		if (next.active.adaptations.length > prev.active.adaptations.length) track("workout_adapted", { adaptation: next.active.adaptations[next.active.adaptations.length - 1] ?? "" });
		if (!prev.active.safetyStop && next.active.safetyStop) track("workout_abandoned", { setsDone: 0, reason: "safety-stop" });
	}
	if (prev.active && !prev.active.safetyStop && !next.active && next.history.length === prev.history.length) {
		track("workout_abandoned", { setsDone: 0, reason: "discarded" });
	}
	const log = next.history.length > prev.history.length ? next.history[next.history.length - 1] : undefined;
	if (prev.active && log && !log.demo) {
		const planned = prev.planned.find((workout) => workout.id === log.plannedId);
		const targetSets = prev.active.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
		const setsDone = log.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
		const quality = !!planned && !planned.adHoc && !prev.active.safetyStop && targetSets > 0 && setsDone / targetSets >= 0.8;
		track("workout_completed", { status: log.status, durationSec: log.durationSec, volumeKg: log.volumeKg, prs: log.prs.length, quality });
		if (log.status === "partial" && !prev.active.safetyStop) track("workout_abandoned", { setsDone, reason: "ended-early" });
	}
	if (prev.profile) {
		for (const id of Object.keys(next.unlocked)) if (!(id in prev.unlocked)) track("achievement_unlocked", { id });
	}
	if (next.coach.filter((m) => m.from === "user").length > prev.coach.filter((m) => m.from === "user").length) track("coach_used", { intent: "message", voice: false });
	if (prev.subscription.tier === "free" && next.subscription.tier === "premium") track("subscription_started", { plan: "premium-trial", demo: true });
}
