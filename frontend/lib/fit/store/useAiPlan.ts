"use client";

import { useCallback, useState } from "react";
import { aiClient } from "../aiClient";
import { dailyCheck, ensureBackend, rebuildPlan } from "../aiFlow";
import { toBackendUser } from "../backendUser";
import type { Scenario } from "../dailyStats";
import { activeTrainerId } from "../options";
import type { Profile } from "../types";
import { useFit } from "./FitProvider";
import { reducer } from "./reducer";

export function useAiPlan() {
	const { state, dispatch, today } = useFit();
	const [busy, setBusy] = useState(false);

	const runDaily = useCallback(
		async (o: { scenario?: Scenario; force?: boolean } = {}): Promise<void> => {
			const profile = state.profile;
			if (!profile) return;
			const trainerSlug = activeTrainerId(state);
			const backend = await ensureBackend(aiClient, { backend: state.backend, profile, trainerSlug, today });
			if (!backend) return;
			if (!state.backend) dispatch({ type: "set-backend", backend });
			const result = await dailyCheck(aiClient, { backend, profile, trainerSlug, planned: state.planned, wishes: state.planWishes, today, daily: state.daily, scenario: o.scenario, force: o.force });
			if (result) dispatch({ type: "apply-daily", ...result });
		},
		[state, dispatch, today],
	);

	const rebuild = useCallback(
		async (o: { profile?: Profile; wishes?: string[] } = {}): Promise<"ai" | "fallback" | "failed"> => {
			const profile = o.profile ?? state.profile;
			if (!profile) return "failed";
			const wishes = o.wishes ?? state.planWishes;
			const trainerSlug = activeTrainerId(state);
			setBusy(true);
			try {
				const backend = await ensureBackend(aiClient, { backend: state.backend, profile, trainerSlug, today });
				if (backend && !state.backend) dispatch({ type: "set-backend", backend });
				if (backend) await aiClient.patchUser(backend.userId, toBackendUser(profile, trainerSlug, today)).catch(() => undefined);
				const plan = await rebuildPlan(aiClient, { backend, profile, trainerSlug, wishes, today });
				if (!plan) return "failed";
				const applied = { type: "apply-ai-plan", planned: plan.planned, summary: plan.summary, source: plan.createdBy, wishes, today } as const;
				dispatch(applied);
				// The forced daily check needs the fresh plan, which is not in `state` until the next render; the reducer is pure, so derive it here.
				if (backend) {
					const result = await dailyCheck(aiClient, { backend, profile, trainerSlug, planned: reducer(state, applied).planned, wishes, today, daily: null, force: true });
					if (result) dispatch({ type: "apply-daily", ...result });
				}
				return plan.createdBy;
			} finally {
				setBusy(false);
			}
		},
		[state, dispatch, today],
	);

	return { busy, rebuild, runDaily };
}
