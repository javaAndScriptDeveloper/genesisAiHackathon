import { useQuery } from "@tanstack/react-query";
import { aiPlanSchema, planFromAi, type PlanRequest } from "@/lib/fit/aiPlan";
import type { ISODate } from "@/lib/fit/dates";
import { generatePlan } from "@/lib/fit/plan";
import type { PlannedWorkout, Profile } from "@/lib/fit/types";

// The personal plan shown at the end of onboarding. Asks POST /api/plan (Gemini writes a week from the user's data)
// and falls back to the rule-based generator when the AI is not configured, fails or is slow, so onboarding always ends with a plan.

export interface PersonalPlan {
	planned: PlannedWorkout[];
	summary: string;
	why: string[];
	source: "ai" | "rules";
}

export const PLAN_WEEKS = 4;

/** Builds the user's plan. Never throws. */
export async function fetchPersonalPlan(request: PlanRequest & { profile: Profile }, today: ISODate, timeoutMs = 25_000): Promise<PersonalPlan> {
	const rules = (): PersonalPlan => ({ planned: generatePlan(request.profile, today, PLAN_WEEKS), summary: "", why: [], source: "rules" });
	try {
		const res = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: AbortSignal.timeout(timeoutMs) });
		if (!res.ok) return rules();
		const reply = aiPlanSchema.safeParse(await res.json());
		if (!reply.success) return rules();
		return { planned: planFromAi(reply.data, request.profile, today, PLAN_WEEKS), summary: reply.data.summary, why: reply.data.why, source: "ai" };
	} catch {
		return rules();
	}
}

/** `request` is null until the quiz reaches the plan screen. Cached per answers, so going back and forth does not re-ask the AI. */
export function usePersonalPlan(request: (PlanRequest & { profile: Profile }) | null, today: ISODate) {
	return useQuery({
		queryKey: ["personal-plan", request, today],
		queryFn: () => (request ? fetchPersonalPlan(request, today) : Promise.reject(new Error("No profile yet"))),
		enabled: request !== null,
		staleTime: Infinity,
		retry: false,
	});
}
