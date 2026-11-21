import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/ai/rateLimit";

describe("createRateLimiter", () => {
	it("allows up to the limit per key per window, then blocks", () => {
		const now = 0;
		const allow = createRateLimiter({ limit: 3, windowMs: 1000, now: () => now });
		expect([allow("a"), allow("a"), allow("a"), allow("a")]).toEqual([true, true, true, false]);
		expect(allow("b")).toBe(true);
	});
	it("frees the key after the window", () => {
		let now = 0;
		const allow = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now });
		expect(allow("a")).toBe(true);
		expect(allow("a")).toBe(false);
		now = 1001;
		expect(allow("a")).toBe(true);
	});
});
