import { beforeEach, describe, expect, it, vi } from "vitest";

const askGemini = vi.fn();
vi.mock("@/lib/ai/gemini", () => ({ askGemini: (...a: unknown[]) => askGemini(...a) }));

import { writeNudge } from "@/lib/ai/nudge";

const trainer = { name: "Mike", tov: "Blunt." };
beforeEach(() => askGemini.mockReset());

describe("writeNudge guard", () => {
	it("returns clean text", async () => {
		askGemini.mockResolvedValue('"Seven weeks. Keep going."');
		expect(await writeNudge(trainer, "streak", { streak: 7 })).toBe("Seven weeks. Keep going.");
	});
	it("returns null when the model invents a number", async () => {
		askGemini.mockResolvedValue("You have a 12 week streak");
		expect(await writeNudge(trainer, "streak", { streak: 7 })).toBeNull();
	});
	it("returns null for an empty reply", async () => {
		askGemini.mockResolvedValue("  ");
		expect(await writeNudge(trainer, "missed", {})).toBeNull();
	});
});
