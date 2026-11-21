import { NextResponse } from "next/server";
import { AiConfigError, generateAiPlan } from "@/lib/ai";
import { planRequestSchema } from "@/lib/fit/aiPlan";

// Writes a personal one-week training template from the onboarding profile (Gemini). The client lays it onto
// dates and falls back to the rule-based generator on any non-200.
export async function POST(request: Request) {
	const body = planRequestSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	try {
		const plan = await generateAiPlan(body.data);
		if (!plan) return NextResponse.json({ error: "Unusable AI reply" }, { status: 502 });
		return NextResponse.json(plan);
	} catch (error) {
		if (error instanceof AiConfigError) return NextResponse.json({ error: error.message }, { status: 503 });
		return NextResponse.json({ error: "AI request failed" }, { status: 502 });
	}
}
