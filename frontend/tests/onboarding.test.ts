import { afterEach, describe, expect, it, vi } from "vitest";
import { TRAINERS } from "@/lib/api/mock/trainers";
import { parseGoal, trainersResponseSchema } from "@/lib/api/onboarding";
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

describe("trainers", () => {
	it("mock list matches the response contract", () => {
		expect(trainersResponseSchema.safeParse({ trainers: TRAINERS }).success).toBe(true);
		expect(new Set(TRAINERS.map((t) => t.id)).size).toBe(TRAINERS.length);
	});
});

describe("parseGoal", () => {
	const stub = (body: unknown, ok = true, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status, json: async () => body })));

	it("uses the AI answer when it is valid JSON", async () => {
		stub({ text: 'Sure: {"goal":"endurance","summary":"You want to run 10K strong."}' });
		await expect(parseGoal("run 10k")).resolves.toEqual({ goal: "endurance", summary: "You want to run 10K strong.", source: "ai" });
	});
	it("falls back to keywords when the AI is not configured", async () => {
		stub({ error: "ANTHROPIC_API_KEY" }, false, 503);
		await expect(parseGoal("lose some weight")).resolves.toEqual({ goal: "lose-fat", summary: "", source: "keywords" });
	});
	it("falls back to keywords on an invalid AI reply", async () => {
		stub({ text: '{"goal":"fly"}' });
		await expect(parseGoal("build muscle")).resolves.toMatchObject({ goal: "build-muscle", source: "keywords" });
	});
	it("falls back to keywords when fetch throws", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
		await expect(parseGoal("get stronger")).resolves.toMatchObject({ goal: "get-stronger", source: "keywords" });
	});
});
