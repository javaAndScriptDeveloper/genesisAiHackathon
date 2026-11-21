import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { matchGoalKeywords } from "@/lib/fit/goal";
import { GOALS } from "@/lib/fit/options";
import { apiFetch } from "./client";

// Onboarding quiz contracts. Trainers come from the mock API today and from an AI endpoint later;
// goal parsing uses POST /api/ai with a keyword fallback. Components only see these typed functions.

export const trainerSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	style: z.string(),
	tagline: z.string(),
	intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
	tone: z.enum(["accent", "success", "warning", "danger"]),
	specialties: z.array(z.string()),
});
export type Trainer = z.infer<typeof trainerSchema>;

export const trainersResponseSchema = z.object({ trainers: z.array(trainerSchema) });

export const fetchTrainers = () => apiFetch("/trainers", trainersResponseSchema).then((r) => r.trainers);

export const useTrainers = () => useQuery({ queryKey: ["trainers"], queryFn: fetchTrainers, staleTime: Infinity });

const goalSchema = z.enum(GOALS);

export interface GoalResult {
	goal: z.infer<typeof goalSchema> | null;
	/** Short AI paraphrase of the user's goal; empty when the keyword fallback answered. */
	summary: string;
	source: "ai" | "keywords";
}

const aiReplySchema = z.object({ text: z.string() });
const aiGoalSchema = z.object({ goal: goalSchema, summary: z.string().max(200) });

const SYSTEM = `You classify a fitness app user's goal. Reply with JSON only, no prose: {"goal": one of ${GOALS.map((g) => `"${g}"`).join(", ")}, "summary": a warm one-sentence paraphrase of their goal addressed to them, max 15 words}.`;

const fromKeywords = (text: string): GoalResult => ({ goal: matchGoalKeywords(text), summary: "", source: "keywords" });

/** Understands a free-text or spoken goal. Never throws: falls back to keyword matching on any AI problem. */
export async function parseGoal(text: string, timeoutMs = 6000): Promise<GoalResult> {
	try {
		const res = await fetch("/api/ai", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ provider: "claude", system: SYSTEM, prompt: text }),
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!res.ok) return fromKeywords(text);
		const reply = aiReplySchema.safeParse(await res.json());
		if (!reply.success) return fromKeywords(text);
		const json = /\{[\s\S]*\}/.exec(reply.data.text)?.[0];
		const parsed = aiGoalSchema.safeParse(json ? JSON.parse(json) : null);
		return parsed.success ? { ...parsed.data, source: "ai" } : fromKeywords(text);
	} catch {
		return fromKeywords(text);
	}
}
