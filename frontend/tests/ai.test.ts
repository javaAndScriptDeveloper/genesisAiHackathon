import { afterEach, describe, expect, it } from "vitest";
import { AiConfigError, askClaude, askGemini } from "@/lib/ai";

const saved = { a: process.env.ANTHROPIC_API_KEY, g: process.env.GEMINI_API_KEY };
afterEach(() => {
	process.env.ANTHROPIC_API_KEY = saved.a;
	process.env.GEMINI_API_KEY = saved.g;
});

describe("ai utilities without keys", () => {
	it("askClaude throws AiConfigError", async () => {
		delete process.env.ANTHROPIC_API_KEY;
		await expect(askClaude({ prompt: "hi" })).rejects.toBeInstanceOf(AiConfigError);
	});
	it("askGemini throws AiConfigError", async () => {
		delete process.env.GEMINI_API_KEY;
		await expect(askGemini({ prompt: "hi" })).rejects.toBeInstanceOf(AiConfigError);
	});
});
