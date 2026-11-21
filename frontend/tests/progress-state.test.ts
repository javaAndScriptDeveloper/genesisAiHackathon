import { describe, expect, it } from "vitest";
import { emptyState, seedHistory } from "@/lib/fit/seed";
import { getExercise } from "@/lib/fit/exercises";
import { ARCHIVE_QUEUE_CAP, reducer } from "@/lib/fit/store/reducer";
import type { FitState, Profile } from "@/lib/fit/types";
import { historyFromFit } from "@/lib/progress/fromFit";
import { progressSnapshot } from "@/lib/progress/engine";
import { personalRecords } from "@/lib/progress/records";
import type { ArchiveItem, ProgressEvent } from "@/lib/progress/types";

const profile: Profile = {
	name: "Test", age: 30, gender: "female", heightCm: 168, weightKg: 70, goal: "build-muscle", experience: "intermediate",
	location: "gym", equipment: ["dumbbells", "bench", "barbell", "machines"], durationMin: 45, daysPerWeek: 3, limitations: [], limitationNote: "", wearable: "none",
};
const today = "2026-11-19";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ev = (id: string, kind: ProgressEvent["kind"] = "badge", seenAt: string | null = null): ProgressEvent => ({ id, kind, refId: id, createdAt: "2026-11-19T10:00:00Z", seenAt });
const emptySnapshot = progressSnapshot({ today, exercises: [], plan: [], sessions: [], body: [], checkIns: [], device: null }, { weeklyGoal: 3, pauses: [] });
const item = (id: string, period: ArchiveItem["period"]): ArchiveItem => ({ id, period, weekStart: null, takenAt: "2026-11-19T10:00:00Z", engineVersion: "1", payload: emptySnapshot, payloadHash: id });

describe("progress state", () => {
	it("hydrate of old JSON adds defaults", () => {
		const keys = ["progressToken", "weeklyGoal", "progressEvents", "archivedWeeks", "archiveQueue"];
		const old = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries({ ...emptyState(), profile }).filter(([k]) => !keys.includes(k))))) as FitState;
		const s = reducer(emptyState(), { type: "hydrate", state: old });
		expect(s.progressToken).toMatch(UUID);
		expect(s.weeklyGoal).toBe(3);
		expect([s.progressEvents, s.archivedWeeks, s.archiveQueue]).toEqual([[], [], []]);
		const again = reducer(emptyState(), { type: "hydrate", state: s });
		expect(again.progressToken).toBe(s.progressToken);
	});

	it("record-events is idempotent and keeps seenAt", () => {
		let s = reducer(emptyState(), { type: "record-events", events: [ev("a")] });
		s = reducer(s, { type: "mark-seen", ids: ["a"], now: "T1" });
		s = reducer(s, { type: "record-events", events: [ev("a"), ev("b"), ev("b")] });
		expect(s.progressEvents.map((e) => e.id)).toEqual(["a", "b"]);
		expect(s.progressEvents[0]?.seenAt).toBe("T1");
	});

	it("mark-seen by kind/ids only sets null seenAt", () => {
		let s = reducer(emptyState(), { type: "record-events", events: [ev("a", "badge"), ev("b", "pr"), ev("c", "level", "OLD"), ev("d", "report")] });
		s = reducer(s, { type: "mark-seen", kinds: ["badge", "level"], ids: ["d"], now: "T2" });
		expect(s.progressEvents.map((e) => e.seenAt)).toEqual(["T2", null, "OLD", "T2"]);
	});

	it("set-weekly-goal clamps to 2..5", () => {
		const g = (n: number) => reducer(emptyState(), { type: "set-weekly-goal", goal: n }).weeklyGoal;
		expect([g(0), g(2), g(4), g(9)]).toEqual([2, 2, 4, 5]);
	});

	it("archive queue caps at 50, dropping oldest change items, never weekly", () => {
		const items = [item("w0", "weekly"), ...Array.from({ length: 49 }, (_, i) => item(`c${i}`, "change"))];
		let s = reducer(emptyState(), { type: "archive-queued", items });
		expect(s.archiveQueue).toHaveLength(50);
		s = reducer(s, { type: "archive-queued", items: [item("w1", "weekly"), item("c49", "change")] });
		expect(s.archiveQueue).toHaveLength(ARCHIVE_QUEUE_CAP);
		const ids = s.archiveQueue.map((i) => i.id);
		expect(ids).toContain("w0");
		expect(ids).toContain("w1");
		expect(ids).not.toContain("c0");
		expect(ids).not.toContain("c1");
		expect(ids).toContain("c49");
	});

	it("archive-sent removes ids and adds unique weeks", () => {
		let s = reducer(emptyState(), { type: "archive-queued", items: [item("a", "weekly"), item("b", "change")] });
		s = reducer(s, { type: "archive-sent", ids: ["a"], weeks: ["2026-11-09"] });
		s = reducer(s, { type: "archive-sent", ids: [], weeks: ["2026-11-09", "2026-11-02"] });
		expect(s.archiveQueue.map((i) => i.id)).toEqual(["b"]);
		expect(s.archivedWeeks).toEqual(["2026-11-09", "2026-11-02"]);
	});

	it("onboarding sets weeklyGoal from daysPerWeek", () => {
		const s = reducer(emptyState(), { type: "complete-onboarding", units: "metric", profile: { ...profile, daysPerWeek: 6 }, demoHistory: false, today, now: "2026-11-19T10:00:00Z" });
		expect(s.weeklyGoal).toBe(5);
	});
});

describe("12-week demo history", () => {
	const seed = seedHistory(profile, today);
	const h = historyFromFit(seed, today);

	it("is deterministic", () => {
		// Block ids come from a clock-based generator in lib/fit/plan.ts; everything else must match.
		const again = seedHistory(profile, today);
		const shape = (x: typeof seed) => ({ ...x, planned: x.planned.map((w) => ({ ...w, exercises: w.exercises.map(({ id: _id, ...b }) => b) })) });
		expect(shape(again)).toEqual(shape(seed));
	});
	it("spans 12 weeks", () => {
		const first = seed.history[0]?.date ?? today;
		expect((Date.parse(today) - Date.parse(first)) / 86_400_000).toBeGreaterThanOrEqual(11 * 7 - 6);
	});
	it("has skipped workouts and one fully paused week", () => {
		expect(seed.planned.filter((w) => w.status === "skipped").length).toBeGreaterThanOrEqual(2);
		const p = seed.pauses[0];
		expect(seed.pauses).toHaveLength(1);
		if (!p) throw new Error("no pause");
		const inPause = seed.planned.filter((w) => w.date >= p.from && w.date <= p.to);
		expect(inPause.length).toBeGreaterThan(0);
		expect(inPause.every((w) => w.status === "skipped")).toBe(true);
		expect(seed.history.some((l) => l.date >= p.from && l.date <= p.to)).toBe(false);
	});
	it("has at least 3 personal records", () => {
		expect(personalRecords(h).length).toBeGreaterThanOrEqual(3);
	});
	it("has weighted, bodyweight and timed exercises", () => {
		const kinds = new Set(h.exercises.map((e) => e.kind));
		expect(kinds).toEqual(new Set(["weighted", "bodyweight", "timed"]));
		expect(seed.history.some((l) => l.exercises.some((e) => getExercise(e.exerciseId).timed))).toBe(true);
	});
	it("has 3-5 weigh-ins in every full week, with timestamps", () => {
		const byWeek = new Map<string, number>();
		for (const b of seed.bodyWeights) {
			expect(b.at).toBeDefined();
			const d = new Date(`${b.date}T00:00:00`);
			d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
			const k = d.toDateString();
			byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
		}
		const counts = [...byWeek.values()];
		expect(counts.length).toBeGreaterThanOrEqual(12);
		// the oldest 12 weeks are full; the current week may be cut by today
		for (const c of counts.slice(0, 12)) {
			expect(c).toBeGreaterThanOrEqual(3);
			expect(c).toBeLessThanOrEqual(5);
		}
	});
	it("keeps the demo flags", () => {
		expect(seed.hasDemoHistory).toBe(true);
		expect(seed.history.every((l) => l.demo === true)).toBe(true);
	});
});
