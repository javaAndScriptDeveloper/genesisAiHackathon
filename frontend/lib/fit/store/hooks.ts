"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { weeklyChallenge, levelOf, totalXp } from "../gamification";
import { nextUpcoming } from "../plan";
import { computeStreak, consistencyScore, daysSinceLastWorkout, personalRecords, weekStats } from "../stats";
import { fmtLoad, fmtMass, loadStep, loadValue, massUnit, massValue, toKg } from "../units";
import { useFit } from "./FitProvider";

export function useStartWorkout() {
	const { dispatch } = useFit();
	const router = useRouter();
	return useCallback(
		(plannedId: string) => {
			dispatch({ type: "start-workout", plannedId, now: new Date().toISOString() });
			router.push("/workout");
		},
		[dispatch, router],
	);
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
