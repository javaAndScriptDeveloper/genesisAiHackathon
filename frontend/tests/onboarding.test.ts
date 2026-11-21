import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGoal } from "@/lib/api/onboarding";
import { matchGoalKeywords } from "@/lib/fit/goal";

afterEach(() => vi.unstubAllGlobals());

describe("matchGoalKeywords", () => {
	it.each([
		["I want to lose 5 kg before summer", "lose-fat"],
		["Build muscle and get toned", "build-muscle"],
		["get stronger at pull-ups", "get-stronger"],
		["Run my first 10K", "endurance"],
		["just feel healthy and have more energy", "stay-fit"],
		["хочу схуднути", "lose-fat"],
	] as const)("%s → %s", (text, goal) => {
		expect(matchGoalKeywords(text)).toBe(goal);
	});
	it("returns null when nothing matches", () => {
		expect(matchGoalKeywords("banana")).toBeNull();
	});
});

describe("parseGoal", () => {
	const stub = (body: unknown, ok = true, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status, json: async () => body })));

	it("uses the AI answer from /api/goal", async () => {
		stub({ goal: "endurance" });
		await expect(parseGoal("I want to finish a triathlon")).resolves.toEqual({ goal: "endurance", source: "ai" });
	});
	it("falls back to keywords when the AI could not tell", async () => {
		stub({ goal: null });
		await expect(parseGoal("build muscle")).resolves.toEqual({ goal: "build-muscle", source: "keywords" });
	});
	it("falls back to keywords when the AI is not configured", async () => {
		stub({ error: "GEMINI_API_KEY" }, false, 503);
		await expect(parseGoal("lose some weight")).resolves.toEqual({ goal: "lose-fat", source: "keywords" });
	});
	it("falls back to keywords on an invalid AI reply", async () => {
		stub({ goal: "fly" });
		await expect(parseGoal("build muscle")).resolves.toMatchObject({ goal: "build-muscle", source: "keywords" });
	});
	it("falls back to keywords when fetch throws", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
		await expect(parseGoal("get stronger")).resolves.toMatchObject({ goal: "get-stronger", source: "keywords" });
	});
});
