import { NextResponse } from "next/server";
import { coachChat } from "@/lib/ai/planner";
import { getSnapshots, getTrainerTov } from "@/lib/api/platform";
import { coachRequestSchema, type CoachResponse } from "@/lib/fit/aiApi";
import { isSafetyConcern, safetyReplyText } from "@/lib/fit/coach";

// Trainer chat: symptom messages never reach Gemini; if Gemini is unavailable the browser falls back to the regex coach.
export async function POST(request: Request) {
	const body = coachRequestSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	const { userId, profile, trainerSlug, wishes, planSummary, messages } = body.data;

	const last = messages[messages.length - 1];
	if (last && isSafetyConcern(last.text)) {
		const response: CoachResponse = { reply: safetyReplyText(), rebuild: null, safety: true };
		return NextResponse.json(response);
	}

	// Earlier symptom messages (and the safety replies quoting them) stay out of the AI's context too.
	const history = messages.filter((m) => !isSafetyConcern(m.text));

	try {
		const [stats, trainer] = await Promise.all([userId === null ? Promise.resolve([]) : getSnapshots(userId, 7), getTrainerTov(trainerSlug)]);
		const ai = await coachChat(trainer, { profile, stats, wishes, planSummary, messages: history });
		const response: CoachResponse = { reply: ai.reply, rebuild: ai.rebuild, safety: false };
		return NextResponse.json(response);
	} catch (error) {
		console.error("AI coach failed", error instanceof Error ? error.message : "unknown");
		return NextResponse.json({ error: "Coach unavailable" }, { status: 503 });
	}
}
