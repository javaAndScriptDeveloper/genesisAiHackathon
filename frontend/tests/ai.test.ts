import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/goal/route";
import { AiConfigError, askClaude, askGemini } from "@/lib/ai";
import { parseGoalReply } from "@/lib/fit/goalParse";

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

describe("parseGoalReply", () => {
	it("accepts plain JSON", () => {
		expect(parseGoalReply('{"goal":"build-muscle"}')).toBe("build-muscle");
	});
	it("accepts JSON wrapped in code fences", () => {
		expect(parseGoalReply('```json\n{"goal":"endurance"}\n```')).toBe("endurance");
	});
	it("rejects a goal outside the preset list", () => {
		expect(parseGoalReply('{"goal":"fly"}')).toBeNull();
	});
	it("rejects non-JSON and empty replies", () => {
		expect(parseGoalReply("not json")).toBeNull();
		expect(parseGoalReply("")).toBeNull();
	});
});

describe("POST /api/goal", () => {
	const post = (body: unknown) => POST(new Request("http://localhost/api/goal", { method: "POST", body: JSON.stringify(body) }));
	it("rejects an empty or whitespace-only text with 400", async () => {
		expect((await post({ text: "" })).status).toBe(400);
		expect((await post({ text: "   " })).status).toBe(400);
	});
	it("rejects text over 500 characters with 400", async () => {
		expect((await post({ text: "a".repeat(501) })).status).toBe(400);
	});
	it("answers 503 when the Gemini key is missing", async () => {
		delete process.env.GEMINI_API_KEY;
		expect((await post({ text: "run a marathon" })).status).toBe(503);
	});
});
