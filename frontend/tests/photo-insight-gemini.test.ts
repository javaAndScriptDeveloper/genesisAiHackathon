import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
	GoogleGenAI: class {
		models = { generateContent };
	},
	Type: { OBJECT: "OBJECT", BOOLEAN: "BOOLEAN", STRING: "STRING", ARRAY: "ARRAY" },
}));

import { analyzeProgressPhotos } from "@/lib/ai/gemini";

beforeEach(() => {
	process.env.GEMINI_API_KEY = "test";
	generateContent.mockReset();
	generateContent.mockResolvedValue({ text: "{}" });
});

describe("analyzeProgressPhotos", () => {
	it("sends safety rules as systemInstruction, two images and a JSON schema", async () => {
		const img = { mimeType: "image/png", data: Buffer.from("x") };
		await analyzeProgressPhotos({ before: img, after: img, system: "SYS", prompt: "USER" });
		const arg = generateContent.mock.calls[0]![0];
		expect(arg.config.systemInstruction).toBe("SYS");
		expect(arg.config.responseMimeType).toBe("application/json");
		expect(arg.config.responseSchema).toBeDefined();
		const parts = arg.contents[0].parts;
		expect(parts.filter((p: { inlineData?: unknown }) => p.inlineData)).toHaveLength(2);
		expect(parts.at(-1)).toEqual({ text: "USER" });
	});
});
