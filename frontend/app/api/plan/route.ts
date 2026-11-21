import { NextResponse } from "next/server";
import { generateWeek } from "@/lib/ai/planner";
import { getSnapshots, getTrainerTov, saveTraining } from "@/lib/api/platform";
import { planRequestSchema, type PlanResponse } from "@/lib/fit/aiApi";
import { buildPlanFromAi } from "@/lib/fit/aiPlan";
import { generatePlan } from "@/lib/fit/plan";
import { progressTokenOf } from "@/lib/fit/progressToken";
import { t } from "@/lib/messages";

// Builds the user's weekly plan with the AI trainer (onboarding, chat recreate, profile edits). Dates, loads and
// durations are laid out here; any AI problem falls back to the rule-based plan, so this never 5xxs for it.
// With a progress token (`x-progress-token`) it reads the device stats and saves the result as a plan version.
export async function POST(request: Request) {
	const token = progressTokenOf(request);
	if (token === "invalid") return NextResponse.json({ error: "Invalid progress token" }, { status: 400 });
	const body = planRequestSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	const { profile, trainerSlug, wishes, today } = body.data;

	const [stats, trainer] = await Promise.all([token ? getSnapshots(token, 7) : Promise.resolve([]), getTrainerTov(trainerSlug)]);

	let planned = null;
	let summary = "";
	let why: string[] = [];
	try {
		const week = await generateWeek(trainer, { profile, stats, wishes });
		const built = buildPlanFromAi(week, profile, today, 4);
		if (built.valid) {
			planned = built.planned;
			summary = week.summary;
			why = week.why.map((w) => w.trim()).filter(Boolean).slice(0, 4);
		}
	} catch (error) {
		console.error("AI plan generation failed", error instanceof Error ? error.message : "unknown");
	}
	const createdBy = planned ? "ai" : "fallback";
	if (!planned) {
		planned = generatePlan(profile, today, 4);
		summary = t("fit.ai.fallbackSummary", { name: trainer.name }, "en");
	}

	const trainingId = token ? await saveTraining(token, trainerSlug, { kind: createdBy === "ai" ? "weekly" : "fallback", createdBy, inputs: { profile, stats, wishes }, summary, why, planned }) : null;
	const response: PlanResponse = { planned, summary, why, createdBy, trainingId };
	return NextResponse.json(response);
}
