import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { aiClient, type AiDeps } from "@/lib/fit/aiClient";
import { ensureBackend, rebuildPlan } from "@/lib/fit/aiFlow";
import type { ISODate } from "@/lib/fit/dates";
import { generatePlan } from "@/lib/fit/plan";
import type { FitState, PlannedWorkout, Profile } from "@/lib/fit/types";

// The personal plan shown at the end of onboarding, built by the AI trainer flow: save the user under the progress
// token (POST /api/users), register the demo device with a first sync (7 days of stats), then POST /api/plan, which
// asks Gemini, lays the week out, falls back to the rule-based plan and saves the version. If the backend or the route
// is unreachable or slow, the rule-based generator runs here, so onboarding always ends with a plan.

type Backend = NonNullable<FitState["backend"]>;

export interface PersonalPlan {
	planned: PlannedWorkout[];
	summary: string;
	why: string[];
	/** "ai" / "fallback": made by /api/plan; "rules": the route was not reachable, built locally. */
	source: "ai" | "fallback" | "rules";
	backend: Backend | null;
}

export interface PlanInput {
	profile: Profile;
	trainerSlug: string;
}

export const PLAN_WEEKS = 4;
const TIMEOUT_MS = 25_000;

/** Builds the user's plan. Never throws. `known` is a device registered by an earlier call (the user went back and changed answers). */
export async function fetchPersonalPlan(input: PlanInput, today: ISODate, token: string, known: Backend | null = null, deps: AiDeps = aiClient, timeoutMs = TIMEOUT_MS): Promise<PersonalPlan> {
	let backend: Backend | null = known;
	const rules = (): PersonalPlan => ({ planned: generatePlan(input.profile, today, PLAN_WEEKS), summary: "", why: [], source: "rules", backend });
	const build = async (): Promise<PersonalPlan> => {
		if (known) await deps.saveUser(input.profile, input.trainerSlug, token);
		else backend = await ensureBackend(deps, { backend: null, profile: input.profile, trainerSlug: input.trainerSlug, today, token });
		const plan = await rebuildPlan(deps, { profile: input.profile, trainerSlug: input.trainerSlug, wishes: [], today, token });
		return plan ? { planned: plan.planned, summary: plan.summary, why: plan.why, source: plan.createdBy, backend } : rules();
	};
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<PersonalPlan>((resolve) => {
		timer = setTimeout(() => resolve(rules()), timeoutMs);
	});
	try {
		return await Promise.race([build(), timeout]);
	} catch {
		return rules();
	} finally {
		clearTimeout(timer);
	}
}

/** `input` is null until the quiz reaches the plan screen. Cached per answers, so going back and forth does not re-ask the AI. */
export function usePersonalPlan(input: PlanInput | null, today: ISODate, token: string) {
	// One device per onboarding: a rebuild after changed answers re-saves the user and reuses it.
	const device = useRef<Backend | null>(null);
	return useQuery({
		queryKey: ["personal-plan", input, today, token],
		queryFn: async () => {
			if (!input) throw new Error("No profile yet");
			const plan = await fetchPersonalPlan(input, today, token, device.current);
			device.current = plan.backend;
			return plan;
		},
		enabled: input !== null,
		staleTime: Infinity,
		retry: false,
	});
}
