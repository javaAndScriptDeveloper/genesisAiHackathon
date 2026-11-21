"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { aiClient } from "../aiClient";
import { dailyCheck, ensureBackend, rebuildPlan } from "../aiFlow";
import { toBackendUser } from "../backendUser";
import { createGate, singleFlight } from "../singleFlight";
import type { Scenario } from "../dailyStats";
import { activeTrainerId } from "../options";
import type { Profile } from "../types";
import type { Dispatch } from "react";
import { useFit } from "./FitProvider";
import { reducer, type Action } from "./reducer";

type Backend = { userId: number; deviceId: number };

// Several components use this hook at once, so the guards are shared at module level.
const ensureShared = singleFlight(async (args: Parameters<typeof ensureBackend>[1], dispatch: Dispatch<Action>): Promise<Backend | null> => {
	const backend = await ensureBackend(aiClient, args);
	if (backend) dispatch({ type: "set-backend", backend });
	return backend;
});
const dailyGate = createGate();

export function useAiPlan() {
	const fit = useFit();
	const { dispatch, today } = fit;
	const [busy, setBusy] = useState(false);
	// Always read the latest state: callbacks may outlive the render that created them.
	const latest = useRef(fit.state);
	useLayoutEffect(() => {
		latest.current = fit.state;
	});

	const ensure = useCallback(
		async (profile: Profile): Promise<Backend | null> => {
			const { backend } = latest.current;
			if (backend) return backend;
			return ensureShared({ backend: null, profile, trainerSlug: activeTrainerId(latest.current), today }, dispatch);
		},
		[dispatch, today],
	);

	const runDaily = useCallback(
		(o: { scenario?: Scenario; force?: boolean } = {}): Promise<void> =>
			dailyGate(o.force === true, async () => {
				const profile = latest.current.profile;
				if (!profile) return;
				const backend = await ensure(profile);
				if (!backend) return;
				const s = latest.current;
				const result = await dailyCheck(aiClient, { backend, profile, trainerSlug: activeTrainerId(s), planned: s.planned, wishes: s.planWishes, today, daily: s.daily, scenario: o.scenario, force: o.force });
				if (result) dispatch({ type: "apply-daily", ...result });
			}),
		[ensure, dispatch, today],
	);

	const rebuild = useCallback(
		async (o: { profile?: Profile; wishes?: string[] } = {}): Promise<"ai" | "fallback" | "failed"> => {
			const profile = o.profile ?? latest.current.profile;
			if (!profile) return "failed";
			const wishes = o.wishes ?? latest.current.planWishes;
			const trainerSlug = activeTrainerId(latest.current);
			setBusy(true);
			try {
				const backend = await ensure(profile);
				if (backend) await aiClient.patchUser(backend.userId, toBackendUser(profile, trainerSlug, today)).catch(() => undefined);
				const plan = await rebuildPlan(aiClient, { backend, profile, trainerSlug, wishes, today });
				if (!plan) return "failed";
				const applied = { type: "apply-ai-plan", planned: plan.planned, summary: plan.summary, source: plan.createdBy, wishes, today } as const;
				// The forced daily check needs the fresh plan, which is not in `latest` until the next render; the reducer is pure, so derive it here.
				const planned = reducer(latest.current, applied).planned;
				dispatch(applied);
				if (backend) {
					await dailyGate(true, async () => {
						const result = await dailyCheck(aiClient, { backend, profile, trainerSlug, planned, wishes, today, daily: null, force: true });
						if (result) dispatch({ type: "apply-daily", ...result });
					});
				}
				return plan.createdBy;
			} finally {
				setBusy(false);
			}
		},
		[ensure, dispatch, today],
	);

	return { busy, rebuild, runDaily };
}
