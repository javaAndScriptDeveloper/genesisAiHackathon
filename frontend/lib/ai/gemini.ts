import "server-only";
import { GoogleGenAI } from "@google/genai";
import { AiConfigError } from "./errors";
import { exerciseCatalog, parseAiPlan, type AiPlan, type PlanRequest } from "@/lib/fit/aiPlan";
import { parseGoalReply } from "@/lib/fit/goalParse";
import type { Goal } from "@/lib/fit/types";
import type { AskOptions } from "./claude";

function client() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) throw new AiConfigError("GEMINI_API_KEY");
	// Fail instead of hanging: the UI shows a spinner while it waits on these calls.
	return new GoogleGenAI({ apiKey, httpOptions: { timeout: 20_000 } });
}

const model = (override?: string) => override ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

export async function askGemini({ prompt, system, model: m }: AskOptions): Promise<string> {
	const res = await client().models.generateContent({
		model: model(m),
		contents: prompt,
		config: system ? { systemInstruction: system } : undefined,
	});
	return res.text ?? "";
}

export function streamGemini({ prompt, system, model: m }: AskOptions): ReadableStream<string> {
	const ai = client();
	return new ReadableStream<string>({
		async start(controller) {
			try {
				const stream = await ai.models.generateContentStream({
					model: model(m),
					contents: prompt,
					config: system ? { systemInstruction: system } : undefined,
				});
				for await (const chunk of stream) if (chunk.text) controller.enqueue(chunk.text);
				controller.close();
			} catch (error) {
				controller.error(error);
			}
		},
	});
}

const GOAL_SYSTEM = `Map the user's fitness goal to exactly one preset id: lose-fat, build-muscle, get-stronger, stay-fit, endurance. Reply only with JSON like {"goal":"build-muscle"}. If the text is not about fitness or health at all, reply {"goal":"none"}. Running, cycling, swimming or stamina goals are "endurance". General health or staying active is "stay-fit".`;

export async function classifyGoal(text: string): Promise<Goal | null> {
	const res = await client().models.generateContent({
		model: model(),
		contents: text,
		config: { systemInstruction: GOAL_SYSTEM, responseMimeType: "application/json" },
	});
	return parseGoalReply(res.text ?? "");
}

const PLAN_SYSTEM = `You are a certified strength and conditioning coach writing a one-week training template for one person.
Rules:
- Write exactly one session per training day (the count is given). Sessions repeat every week.
- Use ONLY exercise ids from the provided catalog. Never invent ids. The catalog is already filtered to the person's equipment and injuries.
- Respect the session length: roughly 3 exercises for 20 min, 4 for 30, 5 for 45, 6 for 60, plus an optional mobility finisher.
- Dose by goal and level: strength 3-5 sets of 3-6 reps, rest 120-180s; muscle 3-4x8-12, rest 60-90s; fat loss and endurance 2-3x12-20, rest 30-45s; general fitness 3x10-12. Beginners get fewer sets and easier (level 1-2) exercises.
- For exercises with "timed": true, reps means seconds (20-60).
- Balance muscle groups across the week; do not hit the same muscle hard on back-to-back days.
- Use the person's own words about their goal and any injury note. Older or heavier beginners get gentler, joint-friendly choices.
- "summary": 1-2 sentences in the coach's voice, addressing the person by name. "why": 3-4 short reasons that point to their actual data (goal, age, schedule, equipment, level). No exclamation marks, no emoji.
Reply only with JSON: {"summary": string, "why": string[], "sessions": [{"title": string, "exercises": [{"id": string, "sets": number, "reps": number, "restSec": number}]}]}`;

/** Asks Gemini for a one-week template; `null` when the reply is not usable. Throws on config or provider errors. */
export async function generateAiPlan({ profile, trainer }: PlanRequest): Promise<AiPlan | null> {
	const prompt = JSON.stringify({
		person: profile,
		trainingDaysPerWeek: profile.daysPerWeek,
		coach: trainer ?? null,
		catalog: exerciseCatalog(profile),
	});
	const res = await client().models.generateContent({
		model: model(),
		contents: prompt,
		config: { systemInstruction: PLAN_SYSTEM, responseMimeType: "application/json" },
	});
	return parseAiPlan(res.text ?? "");
}

export async function transcribeAudio({ data, mimeType }: { data: Buffer; mimeType: string }): Promise<string> {
	const res = await client().models.generateContent({
		model: model(),
		contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: data.toString("base64") } }, { text: "Transcribe this audio verbatim. Return only the transcript." }] }],
	});
	return res.text ?? "";
}
