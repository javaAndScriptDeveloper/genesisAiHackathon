"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useMemo } from "react";
import { appInsights, consistencyDeltaOf, reportWeeksOf } from "../../progress/fromFit";
import { weeklyChallenge } from "../gamification";
import { nextUpcoming } from "../plan";
import { daysSinceLastWorkout, personalRecords, weekStats } from "../stats";
import { fmtLoad, fmtMass, loadStep, loadValue, massUnit, massValue, toKg } from "../units";
import { useFit } from "./FitProvider";
import { fitStatsFromSnapshot, progressOf, type ProgressView } from "./progressStats";
import type { Action } from "./reducer";

/**
 * Change state and navigate as one update. Without this the current screen re-renders with the new state first
 * (e.g. Today swaps its hero for "workout in progress") and only then the new page appears, which reads as a flicker.
 * Inside one transition React commits both together once the destination is ready.
 */
export function useActionNavigate() {
	const { dispatch } = useFit();
	const router = useRouter();
	return useCallback(
		(href: string, action?: Action, options?: { replace?: boolean }) => {
			startTransition(() => {
				if (action) dispatch(action);
				if (options?.replace) router.replace(href, { transitionTypes: ["nav-forward"] });
				else router.push(href, { transitionTypes: ["nav-forward"] });
			});
		},
		[dispatch, router],
	);
}

export function useStartWorkout() {
	const go = useActionNavigate();
	return useCallback((plannedId: string) => go("/workout", { type: "start-workout", plannedId, now: new Date().toISOString() }), [go]);
}

/**
 * The single source of progress numbers: the lib/progress snapshot of the current state (streak in weeks, consistency,
 * level/XP, badges, records, advice) plus its input history, context and the unseen "new" events.
 */
export function useProgress(): ProgressView {
	const { state, today } = useFit();
	return useMemo(() => progressOf(state, today), [state, today]);
}

/** Derived numbers shared by Today, Progress and Coach. Streak, consistency, level and XP come from lib/progress. */
export function useFitStats() {
	const { state, today } = useFit();
	return useMemo(() => {
		const week = weekStats(state.planned, state.history, today);
		const lastWeek = weekStats(state.planned, state.history, today, -1);
		return {
			...fitStatsFromSnapshot(progressOf(state, today)),
			week,
			lastWeek,
			challenge: weeklyChallenge(state, today),
			records: personalRecords(state.history),
			next: nextUpcoming(state.planned, today),
			sinceLast: daysSinceLastWorkout(state.history, today),
		};
	}, [state, today]);
}

/** Unit-aware formatting bound to the user's choice (kg or lb). Components never hardcode "kg". */
export function useUnits() {
	const { state } = useFit();
	const units = state.units;
	return useMemo(
		() => ({
			units,
			unit: massUnit(units),
			step: loadStep(units),
			mass: (kg: number, decimals = 0) => massValue(kg, units, decimals),
			load: (kg: number) => loadValue(kg, units),
			toKg: (value: number) => toKg(value, units),
			fmtMass: (kg: number, decimals = 0) => fmtMass(kg, units, decimals),
			fmtLoad: (kg: number) => fmtLoad(kg, units),
		}),
		[units],
	);
}

/** Progress analytics (pure lib/progress) fed from the real app state. Consistency delta uses the same score as the ring. */
export function useProgressAnalytics() {
	const { state, today } = useFit();
	return useMemo(() => {
		const { history, ctx } = progressOf(state, today);
		const consistencyDelta = consistencyDeltaOf(history, ctx);
		return { history, insights: appInsights(history, consistencyDelta), consistencyDelta, reportWeeks: reportWeeksOf(history) };
	}, [state, today]);
}

/** Progress v2 inputs for the calendar: analytics history plus the same context as every other screen. */
export function useProgressCalendar() {
	const { state, today, ready } = useFit();
	return useMemo(() => {
		const { history, ctx } = progressOf(state, today);
		return { history, ctx, today, ready, pauses: ctx.pauses };
	}, [state, today, ready]);
}
