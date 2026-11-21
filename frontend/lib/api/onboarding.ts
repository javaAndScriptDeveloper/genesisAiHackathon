import { z } from "zod";
import { matchGoalKeywords } from "@/lib/fit/goal";
import { GOALS } from "@/lib/fit/options";
import type { Goal } from "@/lib/fit/types";

// Goal parsing for the onboarding quiz. Uses POST /api/goal (Gemini maps free text to a preset) and falls back
// to keyword matching when the AI is not configured, fails or is slow, so the demo always works.

export interface GoalResult {
	goal: Goal | null;
	source: "ai" | "keywords";
}

const replySchema = z.object({ goal: z.enum(GOALS).nullable() });

const fromKeywords = (text: string): GoalResult => ({ goal: matchGoalKeywords(text), source: "keywords" });

/** Understands a typed goal. Never throws. */
export async function parseGoal(text: string, timeoutMs = 6000): Promise<GoalResult> {
	try {
		const res = await fetch("/api/goal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text }),
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!res.ok) return fromKeywords(text);
		const reply = replySchema.safeParse(await res.json());
		if (!reply.success) return fromKeywords(text);
		// The AI could not tell: keywords may still recognise it.
		return reply.data.goal ? { goal: reply.data.goal, source: "ai" } : fromKeywords(text);
	} catch {
		return fromKeywords(text);
	}
}
