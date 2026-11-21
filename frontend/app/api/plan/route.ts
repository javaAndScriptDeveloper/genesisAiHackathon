import { NextResponse } from "next/server";
import { generateWeek } from "@/lib/ai/planner";
import { getSnapshots, getTrainerTov, saveTraining } from "@/lib/api/platform";
import { planRequestSchema, type PlanResponse } from "@/lib/fit/aiApi";
import { buildPlanFromAi } from "@/lib/fit/aiPlan";
import { generatePlan } from "@/lib/fit/plan";
import { t } from "@/lib/messages";

// Builds the user's weekly plan with the AI trainer; any AI problem falls back to the rule-based plan, so this never 5xxs for it.
export async function POST(request: Request) {
	const body = planRequestSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	const { userId, profile, trainerSlug, wishes, today } = body.data;

	const [stats, trainer] = await Promise.all([userId ? getSnapshots(userId, 7) : Promise.resolve([]), getTrainerTov(trainerSlug)]);

	let planned = null;
	let summary = "";
	try {
		const week = await generateWeek(trainer, { profile, stats, wishes });
		const built = buildPlanFromAi(week, profile, today, 4);
		if (built.valid) {
			planned = built.planned;
			summary = week.summary;
		}
	} catch (error) {
		console.error("AI plan generation failed", error instanceof Error ? error.message : "unknown");
	}
	const createdBy = planned ? "ai" : "fallback";
	if (!planned) {
		planned = generatePlan(profile, today, 4);
		summary = t("fit.ai.fallbackSummary", { name: trainer.name }, "en");
	}

	const trainingId = userId ? await saveTraining(userId, trainerSlug, { kind: createdBy === "ai" ? "weekly" : "fallback", createdBy, inputs: { profile, stats, wishes }, summary, planned }) : null;
	const response: PlanResponse = { planned, summary, createdBy, trainingId };
	return NextResponse.json(response);
}
