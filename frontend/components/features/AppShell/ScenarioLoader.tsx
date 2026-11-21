"use client";

import { useEffect } from "react";
import { SCENARIO_IDS, scenarioState, type ScenarioId } from "@/lib/fit/scenarios";
import { useFit } from "@/lib/fit/store/FitProvider";
import { loadState, STORAGE_KEY } from "@/lib/fit/store/persist";

const BACKUP_KEY = "fit.state.backup";

/**
 * Dev-only: `?scenario=S0..S6` swaps the saved state for a named fixture (keeping a one-time backup),
 * `?scenario=restore` brings the backup back. Does nothing in production builds.
 */
export function ScenarioLoader() {
	const { dispatch, ready, today } = useFit();
	useEffect(() => {
		if (process.env.NODE_ENV === "production" || !ready) return;
		const url = new URL(window.location.href);
		const param = url.searchParams.get("scenario");
		if (param === null) return;
		try {
			if (param === "restore") {
				const backup = window.localStorage.getItem(BACKUP_KEY);
				if (backup === null) return;
				window.localStorage.setItem(STORAGE_KEY, backup);
				window.localStorage.removeItem(BACKUP_KEY);
				dispatch({ type: "hydrate", state: loadState() });
			} else if ((SCENARIO_IDS as string[]).includes(param)) {
				if (window.localStorage.getItem(BACKUP_KEY) === null) {
					const current = window.localStorage.getItem(STORAGE_KEY);
					if (current !== null) window.localStorage.setItem(BACKUP_KEY, current);
				}
				dispatch({ type: "hydrate", state: scenarioState(param as ScenarioId, today) });
			} else return;
		} catch {
			return;
		}
		url.searchParams.delete("scenario");
		window.history.replaceState(null, "", url.pathname + url.search + url.hash);
	}, [dispatch, ready, today]);
	return null;
}
