import "server-only";
import { GoogleGenAI } from "@google/genai";
import { AiConfigError } from "./errors";
import type { AskOptions } from "./claude";

function client() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) throw new AiConfigError("GEMINI_API_KEY");
	return new GoogleGenAI({ apiKey });
}

const model = (override?: string) => override ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

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
