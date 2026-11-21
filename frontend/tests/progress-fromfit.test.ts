import { describe, expect, it } from "vitest";
import { seedHistory } from "@/lib/fit/seed";
import type { PlannedWorkout, Profile, SessionLog } from "@/lib/fit/types";
import { historyFromFit } from "@/lib/progress/fromFit";
import { insights } from "@/lib/progress";

const profile: Profile = {
	name: "Test",
	age: 30,
	gender: null,
	heightCm: 170,
	weightKg: 70,
	goal: "stay-fit",
	experience: "beginner",
	location: "home",
	equipment: ["dumbbells"],
	durationMin: 30,
	daysPerWeek: 3,
	limitations: [],
	limitationNote: "",
	wearable: "none",
};

function planned(id: string, date: string, over: Partial<PlannedWorkout> = {}): PlannedWorkout {
	return {
		id,
		date,
		title: "T",
		focus: "f",
		durationMin: 30,
		difficulty: 2,
		exercises: [{ id: `${id}-b`, exerciseId: "goblet-squat", restSec: 60, sets: [{ target: 10, done: false }, { target: 10, done: false }, { target: 10, done: false }] }],
		status: "planned",
		...over,
	};
}

function log(over: Partial<SessionLog> = {}): SessionLog {
	return {
		id: "l1",
		plannedId: "p1",
		date: "2026-11-16",
		title: "T",
		durationSec: 1800,
		status: "completed",
		exercises: [],
		volumeKg: 0,
		perceived: "right",
		adaptations: [],
		xp: 0,
		prs: [],
		...over,
	};
}

describe("historyFromFit", () => {
	it("seed: plan and sessions map without NaN", () => {
		const seed = seedHistory(profile, "2026-11-19");
		const h = historyFromFit(seed, "2026-11-19");
		expect(h.sessions.length).toBe(seed.history.length);
		expect(h.plan.length).toBeGreaterThan(0);
		expect(h.sessions.every((s) => Number.isFinite(s.durationMin) && s.setsPlanned > 0)).toBe(true);
		expect(h.device).toBeNull();
	});

	it("skipped recovery -> rest, skipped busy -> workout (missed)", () => {
		const state = {
			planned: [
				planned("a", "2026-11-09", { status: "skipped", skipReason: "recovery" }),
				planned("b", "2026-11-10", { status: "skipped", skipReason: "busy" }),
				planned("c", "2026-11-12", { status: "completed" }),
				planned("d", "2026-11-13", { status: "planned", adHoc: true }),
			],
			history: [],
			bodyWeights: [],
		};
		const h = historyFromFit(state, "2026-11-19");
		const byDate = new Map(h.plan.map((p) => [p.date, p.type]));
		expect(byDate.get("2026-11-09")).toBe("rest");
		expect(byDate.get("2026-11-10")).toBe("workout");
		expect(byDate.get("2026-11-11")).toBe("rest");
		expect(byDate.get("2026-11-12")).toBe("workout");
		expect(h.plan[h.plan.length - 1]?.date).toBe("2026-11-12");
	});

	it("timed exercise -> durationSec, weight -> weighted, unknown id skipped", () => {
		const state = {
			planned: [planned("p1", "2026-11-16")],
			history: [
				log({
					adaptations: ["easier"],
					perceived: "hard",
					exercises: [
						{ exerciseId: "plank", skipped: false, sets: [{ reps: 45 }] },
						{ exerciseId: "goblet-squat", skipped: false, sets: [{ reps: 10, weight: 12 }, { reps: 8, weight: 12 }] },
						{ exerciseId: "bodyweight-squat", skipped: true, sets: [{ reps: 10 }] },
						{ exerciseId: "nope", skipped: false, sets: [{ reps: 10 }] },
					],
				}),
			],
			bodyWeights: [{ date: "2026-11-16", kg: 70.5 }],
		};
		const h = historyFromFit(state, "2026-11-19");
		const s = h.sessions[0];
		expect(s?.planned).toBe(true);
		expect(s?.adapted).toBe(true);
		expect(s?.rpe).toBe("hard");
		expect(s?.durationMin).toBe(30);
		expect(s?.setsPlanned).toBe(3);
		expect(s?.sets).toContainEqual({ exerciseId: "plank", reps: 0, weightKg: null, durationSec: 45 });
		expect(s?.sets).toContainEqual({ exerciseId: "goblet-squat", reps: 10, weightKg: 12, durationSec: null });
		expect(s?.sets.some((x) => x.exerciseId === "bodyweight-squat")).toBe(false);
		const kinds = Object.fromEntries(h.exercises.map((e) => [e.id, e.kind]));
		expect(kinds.plank).toBe("timed");
		expect(kinds["goblet-squat"]).toBe("weighted");
		expect(kinds.nope).toBeUndefined();
		expect(h.body).toEqual([{ date: "2026-11-16", weightKg: 70.5 }]);
	});

	it("empty state -> empty history, no insights", () => {
		const h = historyFromFit({ planned: [], history: [], bodyWeights: [] }, "2026-11-19");
		expect(h.plan).toEqual([]);
		expect(insights(h)).toEqual([]);
	});
});

describe("appInsights", () => {
	it("consistency hint follows the app delta, never contradicts the badge", async () => {
		const { appInsights } = await import("@/lib/progress/fromFit");
		const { demoHistory } = await import("@/lib/api/mock/progressDb");
		const h = demoHistory();
		expect(appInsights(h, -1).some((i) => i.id === "consistency_up")).toBe(false);
		expect(appInsights({ ...h, sessions: [] }, 3)).toContainEqual({ id: "consistency_up", vars: { delta: 3 } });
		expect(appInsights(h, 5)).toHaveLength(2);
	});
});

describe("historyFromFit: plan-credited sessions", () => {
	const mk = (pl: PlannedWorkout[], logs: SessionLog[]) => ({ planned: pl, history: logs, bodyWeights: [] });
	// Mon 2026-11-16 .. Sun 11-22; Wed = 11-18, Thu = 11-19, Fri = 11-20
	it("done one day late: credits the planned day", async () => {
		const { dayStatus } = await import("@/lib/progress/days");
		const h = historyFromFit(
			mk(
				[planned("m", "2026-11-16", { status: "completed" }), planned("w", "2026-11-18", { status: "completed" }), planned("f", "2026-11-20", { status: "planned" })],
				[log({ id: "lw", plannedId: "w", date: "2026-11-19", exercises: [{ exerciseId: "goblet-squat", skipped: false, sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }] }] })],
			),
			"2026-11-21",
		);
		expect(dayStatus(h, "2026-11-18")).toBe("completed");
		expect(h.plan.find((p) => p.date === "2026-11-19")?.type).toBe("rest");
		expect(insights(h, 4).map((i) => i.id)).not.toContain("weekday_misses");
	});
	it("started early: Friday credited", async () => {
		const { dayStatus } = await import("@/lib/progress/days");
		const h = historyFromFit(
			mk(
				[planned("w", "2026-11-18", { status: "skipped", skipReason: "recovery" }), planned("f", "2026-11-20", { status: "completed" })],
				[log({ id: "lf", plannedId: "f", date: "2026-11-19", exercises: [{ exerciseId: "goblet-squat", skipped: false, sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }] }] })],
			),
			"2026-11-21",
		);
		expect(dayStatus(h, "2026-11-20")).toBe("completed");
	});
	it("partial planned status counts as quality", async () => {
		const { dayStatus, isQualitySession } = await import("@/lib/progress/days");
		const pl = planned("w", "2026-11-18", { status: "partial", exercises: [{ id: "b", exerciseId: "goblet-squat", restSec: 60, sets: Array.from({ length: 10 }, () => ({ target: 10, done: false })) }] });
		const h = historyFromFit(
			mk([pl], [log({ id: "lw", plannedId: "w", date: "2026-11-18", exercises: [{ exerciseId: "goblet-squat", skipped: false, sets: Array.from({ length: 5 }, () => ({ reps: 10 })) }] })]),
			"2026-11-21",
		);
		expect(isQualitySession(h.sessions[0]!)).toBe(true);
		expect(dayStatus(h, "2026-11-18")).toBe("completed");
	});
	it("same-week early start keeps the planned day; the date never changes later", () => {
		// 2026-11-18 (Wed) done for the plan of 2026-11-20 (Fri): same Monday-week.
		const state = mk([planned("p1", "2026-11-20", { status: "completed", logId: "l1" })], [log({ date: "2026-11-18" })]);
		expect(historyFromFit(state, "2026-11-18").sessions[0]?.date).toBe("2026-11-20");
		expect(historyFromFit(state, "2026-11-25").sessions[0]?.date).toBe("2026-11-20");
	});
	it("across a week boundary the session counts on the day it was done, before and after the planned day", () => {
		// Done Sun 2026-11-22 for the plan of Mon 2026-11-23.
		const early = mk([planned("p1", "2026-11-23", { status: "completed", logId: "l1" })], [log({ date: "2026-11-22" })]);
		expect(historyFromFit(early, "2026-11-22").sessions[0]?.date).toBe("2026-11-22");
		expect(historyFromFit(early, "2026-11-30").sessions[0]?.date).toBe("2026-11-22");
		// A missed Friday done the next Monday counts on Monday.
		const late = mk([planned("p1", "2026-11-20", { status: "completed", logId: "l1" })], [log({ date: "2026-11-23" })]);
		expect(historyFromFit(late, "2026-11-23").sessions[0]?.date).toBe("2026-11-23");
	});
	it("ad-hoc log stays on its own date, unplanned", () => {
		const h = historyFromFit(mk([planned("a", "2026-11-19", { adHoc: true, status: "completed" })], [log({ plannedId: "a", date: "2026-11-19" })]), "2026-11-21");
		expect(h.sessions[0]).toMatchObject({ date: "2026-11-19", planned: false });
	});
});

describe("consistencyDeltaOf", () => {
	it("is consistencyV2 now minus consistencyV2 a week ago (same number as the ring)", async () => {
		const { consistencyDeltaOf } = await import("@/lib/progress/fromFit");
		const { consistencyV2 } = await import("@/lib/progress/consistency");
		const P: PlannedWorkout[] = [];
		const L: SessionLog[] = [];
		for (let i = 0; i < 32; i++) {
			const d = new Date(Date.UTC(2026, 9, 19 + i)).toISOString().slice(0, 10);
			const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
			if (![1, 3, 5].includes(wd)) continue;
			const done = d <= "2026-11-19" && !(d >= "2026-11-09" && d <= "2026-11-15");
			P.push(planned(`p${i}`, d, { status: done ? "completed" : "planned", logId: done ? `l${i}` : undefined }));
			if (done) L.push(log({ id: `l${i}`, plannedId: `p${i}`, date: d, exercises: [{ exerciseId: "goblet-squat", skipped: false, sets: [{ reps: 10, weight: 10 }, { reps: 10, weight: 10 }, { reps: 10, weight: 10 }] }] }));
		}
		const h = historyFromFit({ planned: P, history: L, bodyWeights: [] }, "2026-11-19");
		const ctx = { weeklyGoal: 3, pauses: [] };
		const now = consistencyV2(h, ctx).score;
		const ago = consistencyV2({ ...h, today: "2026-11-12" }, ctx).score;
		expect(now).not.toBeNull();
		expect(consistencyDeltaOf(h, ctx)).toBe((now ?? 0) - (ago ?? 0));
		expect(consistencyDeltaOf(h, ctx)).toBeLessThan(0);
		expect(consistencyDeltaOf(historyFromFit({ planned: [], history: [], bodyWeights: [] }, "2026-11-19"), ctx)).toBeNull();
	});
});
