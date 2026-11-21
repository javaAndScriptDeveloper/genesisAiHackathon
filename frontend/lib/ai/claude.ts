import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AiConfigError } from "./errors";

export interface AskOptions {
	prompt: string;
	system?: string;
	model?: string;
	maxTokens?: number;
}

function client() {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new AiConfigError("ANTHROPIC_API_KEY");
	return new Anthropic({ apiKey });
}

const model = (override?: string) => override ?? process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";

export async function askClaude({ prompt, system, model: m, maxTokens = 1024 }: AskOptions): Promise<string> {
	const res = await client().messages.create({
		model: model(m),
		max_tokens: maxTokens,
		system,
		messages: [{ role: "user", content: prompt }],
	});
	return res.content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

export function streamClaude({ prompt, system, model: m, maxTokens = 1024 }: AskOptions): ReadableStream<string> {
	const stream = client().messages.stream({
		model: model(m),
		max_tokens: maxTokens,
		system,
		messages: [{ role: "user", content: prompt }],
	});
	return new ReadableStream<string>({
		async start(controller) {
			try {
				for await (const event of stream) {
					if (event.type === "content_block_delta" && event.delta.type === "text_delta") controller.enqueue(event.delta.text);
				}
				controller.close();
			} catch (error) {
				controller.error(error);
			}
		},
	});
}
