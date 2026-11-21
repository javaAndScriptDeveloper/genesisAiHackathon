import { afterEach, describe, expect, it, vi } from "vitest";
import { archiveOutcome, canPushSync, fromRemote, planArchive, postArchive, remoteSnapshotSchema, toRemote } from "@/lib/api/progressSync";
import { emptyState } from "@/lib/fit/seed";
import { reducer } from "@/lib/fit/store/reducer";
import type { FitState, PhotoInsight, PlannedWorkout, SessionLog } from "@/lib/fit/types";
import { progressSnapshot, snapshotHash } from "@/lib/progress";
import { historyFromFit } from "@/lib/progress/fromFit";
import type { ArchiveItem } from "@/lib/progress/types";

const TODAY = "2026-11-25"; // Wednesday

function planned(id: string, date: string, over: Partial<PlannedWorkout> = {}): PlannedWorkout {
	return {
		id,
		date,
		title: "T",
		focus: "f",
		durationMin: 30,
		difficulty: 2,
		exercises: [{ id: `${id}-b`, exerciseId: "goblet-squat", restSec: 60, sets: [{ target: 10, done: false }, { target: 10, done: false }] }],
		status: "completed",
		...over,
	};
}

function log(id: string, date: string, over: Partial<SessionLog> = {}): SessionLog {
	return {
		id,
		plannedId: null,
		date,
		title: "T",
		durationSec: 1800,
		status: "completed",
		exercises: [
			{ exerciseId: "goblet-squat", skipped: false, sets: [{ reps: 10, weight: 12 }, { reps: 8, weight: 12 }] },
			{ exerciseId: "push-up", skipped: false, sets: [{ reps: 12 }] },
			{ exerciseId: "plank", skipped: false, sets: [{ reps: 45 }] },
		],
		volumeKg: 0,
		perceived: "right",
		adaptations: [],
		xp: 0,
		prs: [],
		...over,
	};
}

function state(over: Partial<FitState> = {}): FitState {
	return {
		...emptyState(),
		planned: [planned("p1", "2026-11-16"), planned("p2", "2026-11-18")],
		history: [log("l1", "2026-11-16", { plannedId: "p1" }), log("l2", "2026-11-18", { plannedId: "p2" })],
		pauses: [{ from: "2026-11-02", to: "2026-11-08" }],
		bodyWeights: [
			{ date: "2026-11-10", kg: 71, at: "2026-11-10T08:00:00.000Z" },
			{ date: "2026-11-17", kg: 70.5, at: "2026-11-17T08:00:00.000Z" },
			{ date: "2026-11-17", kg: 70.2, at: "2026-11-17T20:00:00.000Z" },
		],
		goalWeightKg: 65,
		goalSetAt: "2026-11-01T09:00:00.000Z",
		weeklyGoal: 4,
		progressEvents: [{ id: "badge:first", kind: "badge", refId: "first", createdAt: "2026-11-16T10:00:00.000Z", seenAt: null }],
		photos: [{ id: "ph1", date: "2026-11-12", dataUrl: "data:image/jpeg;base64,AAAA" }],
		...over,
	};
}

const insight = (id: string, analyzedAt: string): PhotoInsight => ({
	id, analyzedAt, beforeDate: "2026-10-01", afterDate: "2026-11-12", beforeWeightKg: 72, afterWeightKg: null, model: "gemini-test", engineVersion: "photo-v1", suitable: true,
	result: { summary: "Steadier.", observations: [{ area: "posture", text: "More level." }], encouragement: "Keep going." },
});

describe("photo insights sync", () => {
	it("round-trips through toRemote/fromRemote, matches the schema and never contains data URLs", () => {
		const s = state({ photoInsights: [insight("i1", "2026-11-20T10:00:00.000Z")] });
		const r = toRemote(s, TODAY);
		expect(r.photoInsights).toEqual(s.photoInsights);
		expect(remoteSnapshotSchema.safeParse(r).success).toBe(true);
		expect(JSON.stringify(r)).not.toContain("data:");
		expect(fromRemote(r).photoInsights).toEqual(s.photoInsights);
	});
	it("defaults to an empty list and rejects more than 4 observations", () => {
		expect(toRemote(state(), TODAY).photoInsights).toEqual([]);
		expect(fromRemote({ ...toRemote(state(), TODAY), photoInsights: undefined }).photoInsights).toEqual([]);
		const bad = toRemote(state({ photoInsights: [insight("i1", "2026-11-20T10:00:00.000Z")] }), TODAY);
		bad.photoInsights![0]!.result.observations = Array(5).fill({ area: "a", text: "t" });
		expect(remoteSnapshotSchema.safeParse(bad).success).toBe(false);
	});
});

describe("toRemote", () => {
	it("maps logs to workouts with set kinds", () => {
		const r = toRemote(state(), TODAY);
		expect(r.workouts).toHaveLength(2);
		const w = r.workouts.find((x) => x.id === "l1")!;
		expect(w.planDate).toBe("2026-11-16");
		expect(w.plannedSets).toBe(2);
		expect(w.sets.map((s) => s.kind)).toEqual(["weighted", "weighted", "bodyweight", "timed"]);
		const timed = w.sets[3]!;
		expect(timed.durationSec).toBe(45);
		expect(timed.reps).toBeNull();
		expect(new Set(r.workouts.flatMap((x) => x.sets.map((s) => s.id))).size).toBe(8);
		expect(r.settings).toMatchObject({ weeklyGoal: 4, units: "metric" });
		expect(r.planDays.length).toBe(3);
		expect(r.planDays[1]).toMatchObject({ date: "2026-11-17", type: "rest" });
	});
	it("keeps the last weight per date and never includes data URLs", () => {
		const r = toRemote(state(), TODAY);
		expect(r.weights).toEqual([{ date: "2026-11-10", kg: 71 }, { date: "2026-11-17", kg: 70.2 }]);
		expect(JSON.stringify(r)).not.toContain("data:");
		expect(r.checkIns.some((c) => c.kind === "photo")).toBe(true);
	});
	it("skips demo logs and demo weights", () => {
		const s = state({ hasDemoHistory: true, history: [log("d1", "2026-11-16", { demo: true }), log("l2", "2026-11-18")], bodyWeights: [{ date: "2026-11-01", kg: 80 }, { date: "2026-11-17", kg: 70, at: "2026-11-17T08:00:00.000Z" }] });
		const r = toRemote(s, TODAY);
		expect(r.workouts.map((w) => w.id)).toEqual(["l2"]);
		expect(r.weights).toEqual([{ date: "2026-11-17", kg: 70 }]);
		expect(r.checkIns.filter((c) => c.kind === "weight")).toHaveLength(1);
	});
	it("output matches the strict backend schema", () => {
		expect(remoteSnapshotSchema.safeParse(toRemote(state(), TODAY)).success).toBe(true);
	});
});

describe("fromRemote", () => {
	it("round-trips pauses, weights, events, goal and check-ins", () => {
		const s = state();
		const r = toRemote(s, TODAY);
		const back = fromRemote(r);
		expect(back.pauses).toEqual(s.pauses);
		expect(back.weeklyGoal).toBe(4);
		expect(back.progressEvents).toEqual(s.progressEvents);
		expect(back.goalWeightKg).toBe(65);
		expect(back.bodyWeights?.map((b) => [b.date, b.kg])).toEqual([["2026-11-10", 71], ["2026-11-17", 70.2]]);
		const again = toRemote({ ...emptyState(), ...back, photos: [] }, TODAY);
		const ids = (x: typeof r) => x.checkIns.filter((c) => c.kind !== "photo").map((c) => [c.id, c.kind, c.weightKg, c.goalKg]).sort();
		expect(ids(again)).toEqual(ids({ ...r, checkIns: r.checkIns.filter((c) => !(c.kind === "weight" && c.date === "2026-11-17" && c.weightKg === 70.5)) }));
	});
	it("restores workouts and sets as history", () => {
		const r = toRemote(state(), TODAY);
		const back = fromRemote(r);
		expect(back.history).toHaveLength(2);
		const l = back.history!.find((x) => x.id === "l1")!;
		expect(l.exercises.map((e) => e.exerciseId)).toEqual(["goblet-squat", "push-up", "plank"]);
		expect(l.exercises[0]!.sets).toEqual([{ reps: 10, weight: 12 }, { reps: 8, weight: 12 }]);
		expect(l.exercises[2]!.sets).toEqual([{ reps: 45 }]);
	});
});

describe("apply-remote", () => {
	const remote = toRemote(state(), TODAY);
	it("fills an empty local state", () => {
		const next = reducer(emptyState(), { type: "apply-remote", snapshot: remote });
		expect(next.history).toHaveLength(2);
		expect(next.pauses).toHaveLength(1);
		expect(next.weeklyGoal).toBe(4);
		expect(next.progressEvents).toHaveLength(1);
	});
	it("never overwrites local history or newer local data", () => {
		const local = state({ history: [log("mine", "2026-11-19")], pauses: [], weeklyGoal: 2 });
		const next = reducer(local, { type: "apply-remote", snapshot: remote });
		expect(next.history.map((l) => l.id)).toEqual(["mine"]);
		expect(next.weeklyGoal).toBe(2);
		expect(next.bodyWeights).toEqual(local.bodyWeights);
	});
	it("invalid server JSON is rejected by zod", () => {
		expect(remoteSnapshotSchema.safeParse({ settings: { weeklyGoal: 9, units: "x" } }).success).toBe(false);
		expect(remoteSnapshotSchema.safeParse({ ...remote, workouts: [{ id: 1 }] }).success).toBe(false);
		expect(remoteSnapshotSchema.safeParse(null).success).toBe(false);
	});
});

describe("planArchive", () => {
	const ctxOf = (s: FitState) => ({ weeklyGoal: s.weeklyGoal, pauses: s.pauses });
	const snapOf = (s: FitState) => progressSnapshot(historyFromFit(s, TODAY), ctxOf(s));
	const NOW = "2026-11-25T10:00:00.000Z";
	const base = () => state({ archivedWeeks: ["2026-11-02", "2026-11-09", "2026-11-16"] });

	it("queues one change item when the hash is new", () => {
		const s = base();
		const snap = snapOf(s);
		const items = planArchive(s, snap, snapshotHash(snap), TODAY, { now: NOW });
		const change = items.filter((i) => i.period === "change");
		expect(change).toHaveLength(1);
		expect(change[0]).toMatchObject({ weekStart: null, payloadHash: snapshotHash(snap), takenAt: NOW });
	});
	it("queues nothing when the hash equals the last one", () => {
		const s = base();
		const snap = snapOf(s);
		const h = snapshotHash(snap);
		expect(planArchive(s, snap, h, TODAY, { now: NOW, lastHash: h }).filter((i) => i.period === "change")).toEqual([]);
		const queued: ArchiveItem = { id: "x", period: "change", weekStart: null, takenAt: NOW, engineVersion: "2.0.0", payload: snap, payloadHash: h };
		expect(planArchive({ ...s, archiveQueue: [queued] }, snap, h, TODAY, { now: NOW })).toEqual([]);
	});
	it("queues weekly items for finished weeks that are missing, without duplicates", () => {
		const s = state({ archivedWeeks: ["2026-11-02"], planned: [planned("p0", "2026-11-10"), planned("p1", "2026-11-16"), planned("p2", "2026-11-18")] });
		const snap = snapOf(s);
		const h = snapshotHash(snap);
		const items = planArchive(s, snap, h, TODAY, { now: NOW, lastHash: h });
		const weekly = items.filter((i) => i.period === "weekly");
		expect(weekly.map((i) => i.weekStart)).toEqual(["2026-11-09", "2026-11-16"]);
		const again = planArchive({ ...s, archiveQueue: weekly }, snap, h, TODAY, { now: NOW, lastHash: h });
		expect(again).toEqual([]);
	});
	it("never archives demo-only history", () => {
		const s = state({ hasDemoHistory: true, history: [log("d1", "2026-11-16", { demo: true })] });
		const snap = snapOf(s);
		expect(planArchive(s, snap, snapshotHash(snap), TODAY, { now: NOW })).toEqual([]);
	});
});

describe("archive outcomes and sync gating", () => {
	afterEach(() => vi.unstubAllGlobals());
	it("maps statuses", () => {
		expect([200, 201].map(archiveOutcome)).toEqual(["sent", "sent"]);
		expect([408, 429, 500, 503].map(archiveOutcome)).toEqual(["retry", "retry", "retry", "retry"]);
		expect([400, 404, 409, 413].map(archiveOutcome)).toEqual(["drop", "drop", "drop", "drop"]);
	});
	it("postArchive uses the mapping and retries on network errors", async () => {
		const item: ArchiveItem = { id: "i", period: "change", weekStart: null, takenAt: "2026-11-25T10:00:00.000Z", engineVersion: "2.0.0", payload: {} as never, payloadHash: "h" };
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 400, ok: false }));
		expect(await postArchive("t", item)).toBe("drop");
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		expect(await postArchive("t", item)).toBe("retry");
	});
	it("a rejected weekly recorded in archivedWeeks is not re-planned", () => {
		const s = state({ archivedWeeks: ["2026-11-02", "2026-11-09", "2026-11-16"] });
		const snap = progressSnapshot(historyFromFit(s, TODAY), { weeklyGoal: s.weeklyGoal, pauses: s.pauses });
		const h = snapshotHash(snap);
		expect(planArchive(s, snap, h, TODAY, { lastHash: h })).toEqual([]);
	});
	it("holds back push on an empty device until the pull succeeded", () => {
		expect(canPushSync(0, false)).toBe(false);
		expect(canPushSync(0, true)).toBe(true);
		expect(canPushSync(3, false)).toBe(true);
	});
});
