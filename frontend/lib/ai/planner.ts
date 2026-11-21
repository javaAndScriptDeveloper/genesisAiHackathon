import "server-only";
import { z } from "zod";
import { aiSessionSchema, aiWeekSchema, coachAiReplySchema, type AiSession, type AiWeek, type CoachAiReply } from "@/lib/fit/aiPlan";
import { coachPrompt, dailyPrompt, systemFor, weekPrompt, type TrainerVoice } from "@/lib/fit/aiPrompts";
import { client, model } from "./gemini";

const TIMEOUT_MS = 20_000;

const stripFences = (raw: string) => raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();

/** One structured Gemini call. Throws AiConfigError without a key; Error on timeout, invalid JSON or schema mismatch. */
export async function askJson<T>(schema: z.ZodType<T>, o: { system: string; prompt: string; timeoutMs?: number }): Promise<T> {
	const ai = client();
	const ms = o.timeoutMs ?? TIMEOUT_MS;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`Gemini timed out after ${ms} ms`)), ms);
	});
	try {
		const res = await Promise.race([
			ai.models.generateContent({
				model: model(),
				contents: o.prompt,
				config: { systemInstruction: o.system, responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema), abortSignal: AbortSignal.timeout(ms) },
			}),
			timeout,
		]);
		let value: unknown;
		try {
			value = JSON.parse(stripFences(res.text ?? ""));
		} catch {
			throw new Error("Gemini returned invalid JSON");
		}
		const parsed = schema.safeParse(value);
		if (!parsed.success) throw new Error(`Gemini reply did not match the schema: ${parsed.error.message}`);
		return parsed.data;
	} finally {
		clearTimeout(timer);
	}
}

export const generateWeek = (trainer: TrainerVoice, i: Parameters<typeof weekPrompt>[0]): Promise<AiWeek> =>
	askJson(aiWeekSchema, { system: systemFor(trainer), prompt: weekPrompt(i) });

export const adjustSession = (trainer: TrainerVoice, i: Parameters<typeof dailyPrompt>[0]): Promise<AiSession> =>
	askJson(aiSessionSchema, { system: systemFor(trainer), prompt: dailyPrompt(i) });

export const coachChat = (trainer: TrainerVoice, i: Parameters<typeof coachPrompt>[0]): Promise<CoachAiReply> =>
	askJson(coachAiReplySchema, { system: systemFor(trainer), prompt: coachPrompt(i) });
