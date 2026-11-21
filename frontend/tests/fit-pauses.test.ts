import { describe, expect, it } from "vitest";
import { emptyState } from "@/lib/fit/seed";
import { reducer } from "@/lib/fit/store/reducer";
import type { FitState } from "@/lib/fit/types";

describe("pauses (R11)", () => {
	const base = emptyState();

	it("empty state has no pauses; hydrate of old saved state defaults to []", () => {
		expect(base.pauses).toEqual([]);
		// Old saved state (before pauses existed) comes in without the field.
		const withoutField = Object.fromEntries(Object.entries(base).filter(([k]) => k !== "pauses"));
		const legacy: FitState = JSON.parse(JSON.stringify(withoutField));
		const hydrated = reducer(base, { type: "hydrate", state: legacy });
		expect(hydrated.pauses).toEqual([]);
	});

	it("adds a pause of 1–4 weeks", () => {
		const s = reducer(base, { type: "add-pause", from: "2026-11-16", to: "2026-11-29" });
		expect(s.pauses).toEqual([{ from: "2026-11-16", to: "2026-11-29" }]);
	});

	it("rejects more than 4 weeks or a reversed range", () => {
		expect(reducer(base, { type: "add-pause", from: "2026-11-16", to: "2026-12-14" })).toBe(base);
		expect(reducer(base, { type: "add-pause", from: "2026-11-16", to: "2026-11-15" })).toBe(base);
		expect(reducer(base, { type: "add-pause", from: "2026-11-16", to: "2026-12-13" }).pauses).toHaveLength(1); // exactly 4 weeks
	});

	it("rejects an overlapping pause", () => {
		const s = reducer(base, { type: "add-pause", from: "2026-11-16", to: "2026-11-29" });
		expect(reducer(s, { type: "add-pause", from: "2026-11-23", to: "2026-12-06" })).toBe(s);
		expect(reducer(s, { type: "add-pause", from: "2026-11-30", to: "2026-12-06" }).pauses).toHaveLength(2);
	});

	it("removes a pause by its start", () => {
		const s = reducer(base, { type: "add-pause", from: "2026-11-16", to: "2026-11-22" });
		expect(reducer(s, { type: "remove-pause", from: "2026-11-16" }).pauses).toEqual([]);
		expect(reducer(s, { type: "remove-pause", from: "2026-11-23" })).toBe(s);
	});
});
