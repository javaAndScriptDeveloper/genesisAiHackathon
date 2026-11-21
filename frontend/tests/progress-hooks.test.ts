import { describe, expect, it } from "vitest";
import { nextUpcoming } from "@/lib/fit/plan";
import { scenarioState } from "@/lib/fit/scenarios";
import { fitStatsFromSnapshot, progressCtx, progressOf } from "@/lib/fit/store/progressStats";
import { reducer, type Action } from "@/lib/fit/store/reducer";
import type { FitState } from "@/lib/fit/types";
import { consistencyDeltaOf, historyFromFit } from "@/lib/progress/fromFit";
import { progressSnapshot } from "@/lib/progress/engine";
import { streakV2 } from "@/lib/progress/consistency";
import { xpLedger } from "@/lib/progress/xp";

const today = "2026-11-19";
const now = `${today}T18:00:00.000Z`;
// S2 on 2026-11-19: consistency now and a week ago (fixtures are deterministic).
const DELTA_NOW = 94;
const DELTA_AGO = 100;

const run = (s: FitState, ...actions: Action[]) => actions.reduce(reducer, s);

/** Starts a planned workout and logs every set with `extraKg` on top of its target load. */
function train(s: FitState, plannedId: string, extraKg: number, day = today): FitState {
	const at = `${day}T12:00:00.000Z`;
	let state = run(s, { type: "start-workout", plannedId, now: at });
	for (let i = 0; i < 300 && state.active && state.active.phase !== "summary"; i += 1) {
		const a = state.active;
		if (a.phase === "rest") state = run(state, { type: "skip-rest" });
		else {
			const set = a.exercises[a.index]?.sets.find((x) => !x.done);
			state = run(state, { type: "log-set", reps: set?.target ?? 10, weight: set?.targetWeight !== undefined ? set.targetWeight + extraKg : undefined });
		}
	}
	return run(state, { type: "finish", today: day, now: at });
}

describe("useFitStats / useProgress read one engine", () => {
	it.each(["S0", "S2", "S3", "S4"] as const)("%s: Today, Coach and Progress numbers equal progressSnapshot", (id) => {
		const state = scenarioState(id, today);
		const h = historyFromFit(state, today);
		const ctx = { weeklyGoal: state.weeklyGoal, pauses: state.pauses };
		const snap = progressSnapshot(h, ctx);
		const stats = fitStatsFromSnapshot(progressOf(state, today));
		expect(stats.streak).toEqual({ current: snap.streak.current, longest: snap.streak.best });
		expect(stats.consistency).toBe(snap.consistency.score);
		expect(stats.goal).toEqual({ done: snap.week.quality, target: snap.week.goal });
		expect(stats.level).toEqual(snap.level);
		expect(stats.xp).toBe(xpLedger(h, ctx).reduce((n, e) => n + e.amount, 0));
		expect(stats.level.xp).toBe(stats.xp);
		// The calendar uses the same context, so its streak card matches Today.
		expect(progressCtx(state)).toEqual(ctx);
		expect(streakV2(h, progressCtx(state)).current).toBe(stats.streak.current);
	});

	it("is memoized per state object and day", () => {
		const state = scenarioState("S2", today);
		expect(progressOf(state, today)).toBe(progressOf(state, today));
		expect(progressOf({ ...state }, today)).not.toBe(progressOf(state, today));
	});

	it("S0 has no consistency yet: null, never a verdict-like 0", () => {
		expect(fitStatsFromSnapshot(progressOf(scenarioState("S0", today), today)).consistency).toBeNull();
	});

	it("consistency delta is the change of the ring's number", () => {
		const { history, ctx, consistency } = progressOf(scenarioState("S2", today), today);
		const weekAgo = progressSnapshot({ ...history, today: "2026-11-12" }, ctx).consistency.score;
		expect(consistency.score).toBe(DELTA_NOW);
		expect(weekAgo).toBe(DELTA_AGO);
		expect(consistencyDeltaOf(history, ctx)).toBe(DELTA_NOW - DELTA_AGO);
	});
});

describe("finish records progress events", () => {
	it("a workout with a new record adds a pr event once", () => {
		const s2 = { ...scenarioState("S2", today), progressEvents: [] };
		const next = nextUpcoming(s2.planned, today);
		if (!next) throw new Error("no upcoming workout");
		const after = train(s2, next.id, 40);
		const prs = after.progressEvents.filter((e) => e.kind === "pr");
		expect(prs.length).toBeGreaterThan(0);
		expect(prs.every((e) => e.seenAt === null && e.createdAt === `${today}T12:00:00.000Z`)).toBe(true);
		// The session's XP is the engine's.
		const log = after.history[after.history.length - 1];
		expect(log?.xp).toBeGreaterThan(0);
		// Finishing again without an active session, or re-recording the same events, changes nothing.
		expect(run(after, { type: "finish", today, now })).toBe(after);
		expect(run(after, { type: "record-events", events: prs })).toBe(after);
		// Repeating the same workout with the same loads beats nothing: no new pr event.
		const again = train(after, next.id, 40);
		expect(again.progressEvents.filter((e) => e.kind === "pr")).toHaveLength(prs.length);
	});

	it("never writes the legacy unlocked/celebrate fields", () => {
		const s2 = { ...scenarioState("S2", today), progressEvents: [] };
		const next = nextUpcoming(s2.planned, today);
		if (!next) throw new Error("no upcoming workout");
		const after = train(s2, next.id, 0);
		expect(after.unlocked).toEqual(s2.unlocked);
		expect(after.celebrate).toEqual(s2.celebrate);
	});

	it("sync records last week's report once", () => {
		const s2 = { ...scenarioState("S2", today), progressEvents: [] };
		const once = run(s2, { type: "sync", now });
		const reports = once.progressEvents.filter((e) => e.kind === "report");
		expect(reports).toHaveLength(1);
		const twice = run(once, { type: "sync", now });
		expect(twice.progressEvents.filter((e) => e.kind === "report")).toHaveLength(1);
	});
});

describe("sync records rollover events", () => {
	const at = (day: string) => `${day}T12:00:00.000Z`;

	it("crossing into a new week that credits a perfect week records the badge once", () => {
		const monday = "2026-11-16";
		let s = scenarioState("S0", monday);
		s = run(s, { type: "sync", now: at(monday) });
		const week = s.planned.filter((w) => !w.adHoc && w.date >= monday && w.date <= "2026-11-22");
		expect(week.length).toBeGreaterThan(0);
		for (const w of week) s = train(s, w.id, 0, w.date);
		s = run(s, { type: "sync", now: at("2026-11-22") });
		expect(s.progressEvents.some((e) => e.id === "badge:perfect-week")).toBe(false);
		s = run(s, { type: "sync", now: at("2026-11-23") });
		expect(s.progressEvents.filter((e) => e.id === "badge:perfect-week")).toHaveLength(1);
		expect(s.lastProgressDay).toBe("2026-11-23");
		const again = run(s, { type: "sync", now: at("2026-11-23") });
		expect(again.progressEvents.filter((e) => e.id === "badge:perfect-week")).toHaveLength(1);
		expect(run(again, { type: "sync", now: at("2026-11-24") }).progressEvents.filter((e) => e.id === "badge:perfect-week")).toHaveLength(1);
	});

	it("the first sync after hydrating an old save announces nothing retroactively", () => {
		// A save from before this field existed: serialized without lastProgressDay, like localStorage holds it.
		const { lastProgressDay: _unused, ...rest } = { ...scenarioState("S2", "2026-10-01"), progressEvents: [] };
		void _unused;
		const old: FitState = JSON.parse(JSON.stringify(rest));
		const hydrated = run(scenarioState("S0", today), { type: "hydrate", state: old });
		const synced = run(hydrated, { type: "sync", now: new Date().toISOString() });
		expect(synced.progressEvents.filter((e) => e.kind === "badge" || e.kind === "level" || e.kind === "pr")).toEqual([]);
	});
});
