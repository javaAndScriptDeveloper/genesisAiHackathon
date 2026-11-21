import { describe, expect, it } from "vitest";
import { historyFromFit } from "@/lib/progress/fromFit";
import { checkInSummary } from "@/lib/progress";
import type { History } from "@/lib/progress";

const today = "2026-11-21"; // Saturday
const base = { planned: [], history: [] };
const empty: History = { today, exercises: [], plan: [], sessions: [], body: [], checkIns: [], device: null };

describe("check-ins in the engine", () => {
	it("keeps 3 same-day weigh-ins; last by at", () => {
		const h = historyFromFit(
			{ ...base, bodyWeights: [
				{ date: today, kg: 80, at: "2026-11-21T08:00:00Z" },
				{ date: today, kg: 79.5, at: "2026-11-21T21:00:00Z" },
				{ date: today, kg: 80.2, at: "2026-11-21T12:00:00Z" },
			], goalWeightKg: 75, goalSetAt: "2026-11-01T10:00:00Z", photos: [] },
			today,
		);
		expect(h.checkIns.filter((c) => c.kind === "weight")).toHaveLength(3);
		const s = checkInSummary(h);
		expect(s.lastWeighIn).toEqual({ date: today, kg: 79.5 });
		expect(s.toGoalKg).toBe(4.5);
		expect(s.weighInsThisWeek).toBe(3);
		expect(s.goalKg).toBe(75);
	});
	it("dedupes ids and counts windows", () => {
		const h = historyFromFit({ ...base, bodyWeights: [{ date: "2026-10-01", kg: 80 }, { date: "2026-10-01", kg: 81 }, { date: "2026-11-10", kg: 79 }], goalWeightKg: null }, today);
		expect(new Set(h.checkIns.map((c) => c.id)).size).toBe(3);
		expect(checkInSummary(h).weighInsLast4Weeks).toBe(1);
	});
	it("empty state gives zeros and nulls", () => {
		expect(checkInSummary(empty)).toEqual({ lastWeighIn: null, weighInsThisWeek: 0, weighInsLast4Weeks: 0, photos: 0, lastPhotoDate: null, goalKg: null, toGoalKg: null });
	});
	it("never copies photo payloads", () => {
		const h = historyFromFit({ ...base, bodyWeights: [], goalWeightKg: null, photos: [{ id: "a", date: "2026-11-20", dataUrl: "data:image/png;base64,AAAA", weightKg: 80 }] }, today);
		expect(JSON.stringify(h)).not.toContain("data:");
		expect(checkInSummary(h)).toMatchObject({ photos: 1, lastPhotoDate: "2026-11-20" });
	});
});
