"use client";

import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { aiClient } from "../aiClient";
import { dailyCheck, ensureBackend, rebuildPlan } from "../aiFlow";
import { createGate, singleFlight } from "../singleFlight";
import type { Scenario } from "../dailyStats";
import { activeTrainerId } from "../options";
import type { DailyCheck, FitState, Profile } from "../types";
import type { Dispatch } from "react";
import { useFit } from "./FitProvider";
import { reducer, type Action } from "./reducer";

type Backend = NonNullable<FitState["backend"]>;

// Several components use this hook at once, so the guards are shared at module level.
const ensureShared = singleFlight(async (args: Parameters<typeof ensureBackend>[1], dispatch: Dispatch<Action>): Promise<Backend | null> => {
	const backend = await ensureBackend(aiClient, args);
	if (backend) dispatch({ type: "set-backend", backend });
	return backend;
});
const dailyGate = createGate();

// Work in flight is shared too, so every component sees the same `busy` (e.g. the daily card skeleton while the runner works).
let inflight = 0;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
	listeners.add(cb);
	return () => void listeners.delete(cb);
};
const snapshot = () => inflight > 0;
async function tracked<T>(job: () => Promise<T>): Promise<T> {
	inflight += 1;
	listeners.forEach((l) => l());
	try {
		return await job();
	} finally {
		inflight -= 1;
		listeners.forEach((l) => l());
	}
}

export function useAiPlan() {
	const fit = useFit();
	const { dispatch, today } = fit;
	const busy = useSyncExternalStore(subscribe, snapshot, () => false);
	// Always read the latest state: callbacks may outlive the render that created them.
	const latest = useRef(fit.state);
	useLayoutEffect(() => {
		latest.current = fit.state;
	});

	const ensure = useCallback(
		async (profile: Profile, trainerSlug: string): Promise<{ backend: Backend; fresh: boolean } | null> => {
			const { backend, progressToken: token } = latest.current;
			if (backend) return { backend, fresh: false };
			const created = await ensureShared({ backend: null, profile, trainerSlug, today, token }, dispatch);
			return created ? { backend: created, fresh: true } : null;
		},
		[dispatch, today],
	);

	/** Resolves with the resulting check, or null when no check ran (no profile, backend or response). */
	const runDaily = useCallback(
		(o: { scenario?: Scenario; force?: boolean } = {}): Promise<DailyCheck | null> =>
			tracked(async () => {
				let check: DailyCheck | null = null;
				await dailyGate(o.force === true, async () => {
					const profile = latest.current.profile;
					if (!profile) return;
					const ensured = await ensure(profile, activeTrainerId(latest.current));
					if (!ensured) return;
					const s = latest.current;
					const result = await dailyCheck(aiClient, { backend: ensured.backend, token: s.progressToken, profile, trainerSlug: activeTrainerId(s), planned: s.planned, wishes: s.planWishes, today, daily: s.daily, scenario: o.scenario, force: o.force });
					if (result) {
						const applied = { type: "apply-daily", ...result } as const;
						// The reducer is pure, so the resulting check (with `original`) is derived here for the caller.
						check = reducer(latest.current, applied).daily;
						dispatch(applied);
					}
				});
				return check;
			}),
		[ensure, dispatch, today],
	);

	const rebuild = useCallback(
		async (o: { profile?: Profile; wishes?: string[]; trainerSlug?: string } = {}): Promise<"ai" | "fallback" | "failed"> => {
			const profile = o.profile ?? latest.current.profile;
			if (!profile) return "failed";
			const wishes = o.wishes ?? latest.current.planWishes;
			const trainerSlug = o.trainerSlug ?? activeTrainerId(latest.current);
			const token = latest.current.progressToken;
			return tracked(async () => {
				const ensured = await ensure(profile, trainerSlug);
				// Profile edits re-POST the user (an upsert per token); a fresh registration has just saved it.
				if (ensured && !ensured.fresh) await aiClient.saveUser(profile, trainerSlug, token);
				const backend = ensured?.backend ?? null;
				const plan = await rebuildPlan(aiClient, { profile, trainerSlug, wishes, today, token });
				if (!plan) return "failed";
				const applied = { type: "apply-ai-plan", planned: plan.planned, summary: plan.summary, source: plan.createdBy, wishes, today } as const;
				// The forced daily check needs the fresh plan, which is not in `latest` until the next render; the reducer is pure, so derive it here.
				const planned = reducer(latest.current, applied).planned;
				dispatch(applied);
				if (backend) {
					await dailyGate(true, async () => {
						const result = await dailyCheck(aiClient, { backend, token, profile, trainerSlug, planned, wishes, today, daily: null, force: true });
						if (result) dispatch({ type: "apply-daily", ...result });
					});
				}
				return plan.createdBy;
			});
		},
		[ensure, dispatch, today],
	);

	return { busy, rebuild, runDaily };
}
