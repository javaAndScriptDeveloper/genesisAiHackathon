"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useMemo } from "react";
import { appInsights, consistencyDeltaOf, historyFromFit, reportWeeksOf } from "../../progress/fromFit";
import { weeklyChallenge, levelOf, totalXp } from "../gamification";
import { nextUpcoming } from "../plan";
import { computeStreak, consistencyScore, daysSinceLastWorkout, personalRecords, weekStats } from "../stats";
import { fmtLoad, fmtMass, loadStep, loadValue, massUnit, massValue, toKg } from "../units";
import { useFit } from "./FitProvider";
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

/** Derived numbers shared by Today, Progress and Coach. All of them come from state, never from constants. */
export function useFitStats() {
	const { state, today } = useFit();
	return useMemo(() => {
		const streak = computeStreak(state.planned, today);
		const week = weekStats(state.planned, state.history, today);
		const lastWeek = weekStats(state.planned, state.history, today, -1);
		const level = levelOf(state);
		return {
			streak,
			week,
			lastWeek,
			level,
			xp: totalXp(state),
			consistency: consistencyScore(state.planned, today),
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
		const history = historyFromFit(state, today);
		const consistencyDelta = consistencyDeltaOf(state.planned, today);
		return { history, insights: appInsights(history, consistencyDelta), consistencyDelta, reportWeeks: reportWeeksOf(history) };
	}, [state, today]);
}
