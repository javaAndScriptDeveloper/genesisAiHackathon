import { describe, expect, it } from "vitest";
import { addDays, mondayOf } from "@/lib/fit/dates";
import { SCENARIO_IDS, scenarioState, type ScenarioId } from "@/lib/fit/scenarios";
import type { FitState } from "@/lib/fit/types";
import { badges, consistencyV2, isPausedWeek, levelFor, personalRecords, streakV2, xpLedger } from "@/lib/progress";
import { historyFromFit } from "@/lib/progress/fromFit";
import { weekStart } from "@/lib/progress/dates";

const today = "2026-11-19";

function analyse(state: FitState) {
	const h = historyFromFit(state, today);
	const ctx = { weeklyGoal: state.weeklyGoal, pauses: state.pauses };
	const xp = xpLedger(h, ctx).reduce((n, e) => n + e.amount, 0);
	return { h, ctx, consistency: consistencyV2(h, ctx), streak: streakV2(h, ctx), badges: badges(h, ctx), records: personalRecords(h), level: levelFor(xp) };
}

function hasNaN(v: unknown): boolean {
	if (typeof v === "number") return Number.isNaN(v);
	if (Array.isArray(v)) return v.some(hasNaN);
	if (v && typeof v === "object") return Object.values(v).some(hasNaN);
	return false;
}

describe("progress scenarios", () => {
	it("S0: empty user has no verdicts and no NaN", () => {
		const s = scenarioState("S0", today);
		expect(s.history).toEqual([]);
		expect(s.bodyWeights).toHaveLength(1);
		const a = analyse(s);
		expect(a.consistency.score).toBeNull();
		expect(a.streak.current).toBe(0);
		expect(a.level.level).toBe(1);
		expect(a.records).toEqual([]);
		expect(hasNaN(a)).toBe(false);
	});

	it("S1: first week, still counting", () => {
		const s = scenarioState("S1", today);
		const monday = mondayOf(today);
		expect(s.history.length).toBeGreaterThanOrEqual(1);
		expect(s.history.length).toBeLessThanOrEqual(2);
		expect(s.history.every((l) => l.date >= monday)).toBe(true);
		expect(s.bodyWeights).toHaveLength(1);
		const a = analyse(s);
		expect(a.consistency.score).toBeNull();
		expect(a.badges.find((b) => b.id === "first-workout")?.unlocked).toBe(true);
	});

	it("S2: progress is there, with a pending report, 2 badges and a level event", () => {
		const s = scenarioState("S2", today);
		const a = analyse(s);
		expect(a.consistency.score).toBeGreaterThanOrEqual(60);
		expect(a.consistency.score).toBeLessThanOrEqual(95);
		expect(a.streak.current).toBeGreaterThanOrEqual(2);
		expect(a.records.length).toBeGreaterThanOrEqual(3);
		expect(a.level.level).toBeGreaterThan(1);
		const unseen = s.progressEvents.filter((e) => e.seenAt === null);
		expect(unseen.map((e) => e.kind).sort()).toEqual(["badge", "badge", "level", "report"]);
		const earned = new Set(a.badges.filter((b) => b.unlocked).map((b) => b.id));
		for (const e of unseen.filter((u) => u.kind === "badge")) expect(earned.has(e.refId as never)).toBe(true);
		expect(s.pauses).toHaveLength(1);
	});

	it("S3: pause now keeps the streak as in S2 without the current week", () => {
		const s2 = scenarioState("S2", today);
		const s3 = scenarioState("S3", today);
		const a3 = analyse(s3);
		expect(isPausedWeek(a3.ctx, weekStart(today))).toBe(true);
		const monday = mondayOf(today);
		const without = analyse({ ...s2, history: s2.history.filter((l) => l.date < monday) });
		expect(a3.streak).toEqual(without.streak);
	});

	it("S4: coming back after three idle weeks", () => {
		const s4 = scenarioState("S4", today);
		const a4 = analyse(s4);
		const a2 = analyse(scenarioState("S2", today));
		const monday = mondayOf(today);
		expect(s4.history.filter((l) => l.date >= addDays(monday, -21) && l.date < addDays(today, -1))).toEqual([]);
		expect(s4.history.some((l) => l.date >= addDays(today, -1))).toBe(true);
		expect(a4.streak.current).toBe(0);
		expect(a4.consistency.score ?? 0).toBeLessThan(a2.consistency.score ?? 0);
		for (const w of [-7, -14, -21]) expect(isPausedWeek(a4.ctx, addDays(monday, w))).toBe(false);
	});

	it("S5: bodyweight only, imperial, no weight records", () => {
		const s = scenarioState("S5", today);
		expect(s.units).toBe("imperial");
		const a = analyse(s);
		expect(a.records.length).toBeGreaterThan(0);
		expect(a.records.some((r) => r.metric === "e1rm" || r.metric === "weight")).toBe(false);
	});

	it("S6: free vs premium differ only by tier", () => {
		const free = scenarioState("S6", today, { premium: false });
		const pro = scenarioState("S6", today, { premium: true });
		expect(free.subscription.tier).toBe("free");
		expect(pro.subscription.tier).toBe("premium");
		expect({ ...free, subscription: pro.subscription }).toEqual(pro);
		expect({ ...free, subscription: pro.subscription, progressToken: "" }).toEqual({ ...scenarioState("S2", today), subscription: pro.subscription, progressToken: "" });
	});

	it.each(SCENARIO_IDS)("%s is deterministic and NaN-free", (id: ScenarioId) => {
		const a = scenarioState(id, today);
		expect(a).toEqual(scenarioState(id, today));
		expect(a.progressToken).toMatch(/^[0-9a-f-]{36}$/);
		const r = analyse(a);
		expect(hasNaN([r.consistency, r.streak, r.badges])).toBe(false);
	});
});
