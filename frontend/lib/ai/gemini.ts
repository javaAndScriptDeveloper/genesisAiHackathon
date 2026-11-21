import "server-only";
import { GoogleGenAI } from "@google/genai";
import { AiConfigError } from "./errors";
import { parseGoalReply } from "@/lib/fit/goalParse";
import type { Goal } from "@/lib/fit/types";
import type { AskOptions } from "./claude";

export function client() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) throw new AiConfigError("GEMINI_API_KEY");
	// Fail instead of hanging: the UI shows a spinner while it waits on these calls.
	return new GoogleGenAI({ apiKey, httpOptions: { timeout: 20_000 } });
}

export const model = (override?: string) => override ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

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

export async function transcribeAudio({ data, mimeType }: { data: Buffer; mimeType: string }): Promise<string> {
	const res = await client().models.generateContent({
		model: model(),
		contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: data.toString("base64") } }, { text: "Transcribe this audio verbatim. Return only the transcript." }] }],
	});
	return res.text ?? "";
}
