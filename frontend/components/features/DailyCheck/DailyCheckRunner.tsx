"use client";

import { useEffect } from "react";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useAiPlan } from "@/lib/fit/store/useAiPlan";

/** Renders nothing. Runs the daily readiness check once per date after onboarding. */
export function DailyCheckRunner() {
	const { state, ready, today } = useFit();
	const { runDaily } = useAiPlan();
	const hasProfile = !!state.profile;
	const checked = state.daily?.date === today;

	useEffect(() => {
		if (ready && hasProfile && !checked) void runDaily();
	}, [ready, hasProfile, checked, today, runDaily]);

	return null;
}
