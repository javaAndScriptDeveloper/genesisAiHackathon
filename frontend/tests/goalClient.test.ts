import { afterEach, describe, expect, it, vi } from "vitest";
import { matchGoal } from "@/lib/fit/goalClient";

afterEach(() => vi.unstubAllGlobals());
const stub = (body: unknown, ok = true, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status, json: async () => body })));

describe("matchGoal", () => {
	it("returns matched with the preset", async () => {
		stub({ goal: "endurance" });
		await expect(matchGoal("run a half marathon")).resolves.toEqual({ status: "matched", goal: "endurance" });
	});
	it("returns none when Gemini could not tell", async () => {
		stub({ goal: null });
		await expect(matchGoal("fly to the moon")).resolves.toEqual({ status: "none" });
	});
	it("returns none for a goal outside the presets", async () => {
		stub({ goal: "fly" });
		await expect(matchGoal("x")).resolves.toEqual({ status: "none" });
	});
	it("returns unavailable when the server answers 503 (no key) or 502", async () => {
		stub({ error: "Missing GEMINI_API_KEY" }, false, 503);
		await expect(matchGoal("x")).resolves.toEqual({ status: "unavailable" });
		stub({ error: "AI request failed" }, false, 502);
		await expect(matchGoal("x")).resolves.toEqual({ status: "unavailable" });
	});
	it("returns unavailable on a network error", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
		await expect(matchGoal("x")).resolves.toEqual({ status: "unavailable" });
	});
});
