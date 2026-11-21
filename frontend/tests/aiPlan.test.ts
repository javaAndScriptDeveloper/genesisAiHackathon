import { describe, expect, it } from "vitest";
import { statsSummary, statusForReadiness, type DailyStats } from "@/lib/fit/dailyStats";
import { toBackendUser } from "@/lib/fit/backendUser";
import { buildDailySession, buildPlanFromAi, diffPlans, fallbackDaily } from "@/lib/fit/aiPlan";
import { getExercise } from "@/lib/fit/exercises";
import { generatePlan } from "@/lib/fit/plan";
import type { PlannedWorkout, Profile } from "@/lib/fit/types";

const profile: Profile = {
	name: "Ann",
	age: 30,
	gender: "female",
	heightCm: 170,
	weightKg: 60,
	goal: "stay-fit",
	experience: "beginner",
	location: "home",
	equipment: ["bands"],
	durationMin: 30,
	daysPerWeek: 3,
	limitations: [],
	limitationNote: "",
	wearable: "none",
};

function stat(date: string, readiness: number): DailyStats {
	return { date, sleepHours: 7, sleepScore: 80, restingHr: 58, hrvMs: 60, steps: 5000, activeKcal: 300, readiness, source: "demo", scenario: "normal" };
}

describe("statusForReadiness", () => {
	it("maps the bands", () => {
		expect(statusForReadiness(60)).toBe("unchanged");
		expect(statusForReadiness(59)).toBe("lighter");
		expect(statusForReadiness(40)).toBe("lighter");
		expect(statusForReadiness(39)).toBe("recovery");
	});
});

describe("statsSummary", () => {
	it("handles empty data", () => {
		expect(statsSummary([])).toBe("No device data.");
	});
	it("summarises a window", () => {
		const s = statsSummary([stat("2026-11-20", 70), { ...stat("2026-11-21", 32), scenario: "bad-night" }]);
		expect(s).toContain("readiness today 32/100 (bad-night)");
		expect(s).toContain("2 days");
	});
});

describe("toBackendUser", () => {
	it("derives dob from age", () => {
		expect(toBackendUser(profile, "hanna", "2026-11-21").dob).toBe("1996-11-21");
		expect(toBackendUser(profile, "hanna", "2028-02-29").dob).toBe("1998-02-28");
	});
	it("maps gender, level and onboarding", () => {
		const u = toBackendUser({ ...profile, gender: "private" }, "hanna", "2026-11-21");
		expect(u.gender).toBeNull();
		expect(u.level).toBe("beginner");
		expect(u.trainerSlug).toBe("hanna");
		expect(u.onboarding).toHaveProperty("goal");
		expect(u.onboarding).toHaveProperty("equipment");
		expect(u.onboarding).toHaveProperty("daysPerWeek");
		expect(u.onboarding).not.toHaveProperty("name");
	});
});

describe("AI plan conversion", () => {
	const alex: Profile = {
		name: "Alex", age: 30, gender: null, heightCm: 178, weightKg: 80, goal: "build-muscle", experience: "intermediate",
		location: "home", equipment: ["dumbbells", "bench"], durationMin: 45, daysPerWeek: 3, limitations: [], limitationNote: "", wearable: "none",
	};
	const today = "2026-11-25"; // Wednesday
	const ex = (exerciseId: string, extra: Partial<{ sets: number; reps: number; seconds: number; restSec: number }> = {}) => ({ exerciseId, sets: 3, reps: 10, restSec: 60, ...extra });
	const good = (weekday: number) => ({ weekday, title: "Day", focus: "Mix", exercises: [ex("goblet-squat"), ex("db-row"), ex("plank", { seconds: 30 })] });
	const week = (sessions: ReturnType<typeof good>[]) => ({ summary: "s", sessions });

	it("keeps only library exercises the user can do", () => {
		const { planned } = buildPlanFromAi(week([{ ...good(0), exercises: [ex("goblet-squat"), ex("unicorn-press"), ex("barbell-squat")] }]), alex, today, 1);
		const ids = planned.find((w) => w.exercises.some((b) => b.exerciseId === "goblet-squat" && w.title === "Day"));
		expect(ids).toBeUndefined(); // only one survivor: session dropped, rule fill used
		const { planned: p2 } = buildPlanFromAi(week([{ ...good(4), exercises: [ex("goblet-squat"), ex("unicorn-press"), ex("barbell-squat"), ex("db-row")] }]), alex, today, 1);
		const s = p2.find((w) => w.title === "Day");
		expect(s?.exercises.map((b) => b.exerciseId)).toEqual(["goblet-squat", "db-row"]);
	});

	it("clamps numbers", () => {
		const { planned } = buildPlanFromAi(week([{ ...good(4), exercises: [ex("goblet-squat", { sets: 12, reps: 100, restSec: 5 }), ex("db-row")] }]), alex, today, 1);
		const block = planned.find((w) => w.title === "Day")?.exercises[0];
		expect(block?.sets).toHaveLength(6);
		expect(block?.sets[0]?.target).toBe(30);
		expect(block?.restSec).toBe(15);
	});

	it("lays out 4 weeks on the AI weekdays with w- ids and no past dates", () => {
		const { planned } = buildPlanFromAi(week([good(0), good(2), good(4)]), alex, today, 4);
		expect(planned.every((w) => w.date >= today && w.id === `w-${w.date}` && w.status === "planned")).toBe(true);
		expect(planned.map((w) => w.date)).toEqual([
			"2026-11-25", "2026-11-27", "2026-11-30", "2026-12-02", "2026-12-04", "2026-12-07", "2026-12-09", "2026-12-11", "2026-12-14", "2026-12-16", "2026-12-18",
		]);
	});

	it("fills missing sessions from the rule plan and marks invalid when fewer than half survive", () => {
		const one = buildPlanFromAi(week([good(0)]), alex, today, 1);
		expect(one.valid).toBe(false);
		expect(one.planned).toHaveLength(2); // Wed is today, Mon is past
		const full = buildPlanFromAi(week([good(0)]), alex, "2026-11-23", 1);
		expect(full.planned).toHaveLength(3);
		const two = buildPlanFromAi(week([good(0), good(2)]), alex, "2026-11-23", 1);
		expect(two.valid).toBe(true);
		expect(two.planned).toHaveLength(3);
	});

	it("trims sessions longer than duration + 10", () => {
		const long = Array.from(["goblet-squat", "db-row", "db-shoulder-press", "incline-db-press", "db-hip-thrust", "db-lunge", "db-hammer-curl"], (id) => ex(id, { sets: 6, reps: 30, restSec: 180 }));
		const { planned } = buildPlanFromAi(week([{ ...good(0), exercises: long }, { ...good(2), exercises: long }, { ...good(4), exercises: long }]), alex, "2026-11-23", 1);
		for (const w of planned) {
			expect(w.durationMin).toBeLessThanOrEqual(55);
			expect(w.exercises.length).toBeGreaterThanOrEqual(2);
		}
	});

	it("progresses reps or load in later weeks", () => {
		const { planned } = buildPlanFromAi(week([{ ...good(0), exercises: [ex("goblet-squat"), ex("push-up"), ex("plank", { seconds: 30 })] }, good(2), good(4)]), alex, "2026-11-23", 4);
		const mondays = planned.filter((w) => w.title === "Day" && w.exercises.some((b) => b.exerciseId === "push-up"));
		const [w0, w2, w3] = [mondays[0], mondays[2], mondays[3]];
		const get = (w: PlannedWorkout | undefined, id: string) => w?.exercises.find((b) => b.exerciseId === id)?.sets[0];
		expect(get(w2, "push-up")?.target).toBe(12);
		expect(get(w2, "plank")?.target).toBe(40);
		expect(get(w3, "goblet-squat")?.targetWeight ?? 0).toBeGreaterThan(get(w0, "goblet-squat")?.targetWeight ?? 0);
	});
});

describe("daily sessions", () => {
	const alex: Profile = {
		name: "Alex", age: 30, gender: null, heightCm: 178, weightKg: 80, goal: "build-muscle", experience: "intermediate",
		location: "home", equipment: ["dumbbells", "bench"], durationMin: 45, daysPerWeek: 3, limitations: [], limitationNote: "", wearable: "none",
	};
	const ex = (exerciseId: string, sets = 2, reps = 10) => ({ exerciseId, sets, reps, restSec: 30 });
	const original = generatePlan(alex, "2026-11-23", 1)[0] as PlannedWorkout;
	const load = (w: PlannedWorkout) => w.exercises.reduce((n, b) => n + b.sets.reduce((m, s) => m + (s.targetWeight ?? 1) * s.target, 0), 0);

	it("returns null when lighter has more sets than original or recovery has a strength exercise", () => {
		const orig = totalSetsOf(original);
		const heavy = { note: "n", title: "T", exercises: [ex("goblet-squat", 6), ex("db-row", 6), ex("db-shoulder-press", 6), ex("db-hammer-curl", 6)] };
		expect(orig).toBeLessThan(24);
		expect(buildDailySession(heavy, original, "lighter", alex)).toBeNull();
		const rec = { note: "n", title: "T", exercises: [ex("dead-bug"), ex("goblet-squat")] };
		expect(buildDailySession(rec, original, "recovery", alex)).toBeNull();
	});

	const short: PlannedWorkout = {
		...original,
		durationMin: 10,
		exercises: original.exercises.slice(0, 2).map((b) => ({ ...b, sets: b.sets.slice(0, 2) })),
	};

	it("recovery returns null when it has more sets than a short original", () => {
		const rec = { note: "n", title: "T", exercises: [ex("dead-bug", 3), ex("warrior-ii", 3)] };
		expect(buildDailySession(rec, short, "recovery", alex)).toBeNull();
	});

	it("fallbackDaily recovery fits a short original", () => {
		const rec = fallbackDaily(short, "recovery", alex);
		expect(totalSetsOf(rec)).toBeLessThanOrEqual(totalSetsOf(short));
		expect(rec.durationMin).toBeLessThanOrEqual(short.durationMin);
		expect(rec.id).toBe(short.id);
	});

	it("returns a session keeping the original id", () => {
		const light = buildDailySession({ note: "n", title: "T", exercises: [ex("goblet-squat", 1, 8), ex("db-row", 1, 8)] }, original, "lighter", alex);
		expect(light?.id).toBe(original.id);
		expect(light?.title).toBe(original.title);
		const rec = buildDailySession({ note: "n", title: "Gentle flow", exercises: [ex("dead-bug"), { exerciseId: "warrior-ii", sets: 2, seconds: 30, restSec: 15 }] }, original, "recovery", alex);
		expect(rec?.id).toBe(original.id);
		expect(rec?.focus).toBe("Active recovery");
		expect(rec?.date).toBe(original.date);
	});

	it("fallbackDaily lighter lowers load, recovery is mobility and keeps the id", () => {
		expect(load(fallbackDaily(original, "lighter", alex))).toBeLessThanOrEqual(load(original));
		const rec = fallbackDaily(original, "recovery", alex);
		expect(rec.id).toBe(original.id);
		expect(rec.adHoc).toBeUndefined();
		expect(rec.exercises.every((b) => ["mobility", "core"].includes(getExercise(b.exerciseId).muscle))).toBe(true);
	});

	it("diffPlans lists exercise names added and removed in the next 7 days", () => {
		const mk = (date: string, id: string): PlannedWorkout => ({ ...original, date, id: `w-${date}`, exercises: [{ id: "b", exerciseId: id, restSec: 30, sets: [{ target: 10, done: false }] }] });
		const before = [mk("2026-11-23", "goblet-squat"), mk("2026-11-25", "db-row"), mk("2026-12-20", "plank")];
		const after = [mk("2026-11-23", "goblet-squat"), mk("2026-11-25", "dead-bug"), mk("2026-12-21", "bird-dog")];
		expect(diffPlans(before, after, "2026-11-23")).toEqual({ added: ["Dead bug"], removed: ["One-arm dumbbell row"] });
	});
});

function totalSetsOf(w: PlannedWorkout): number {
	return w.exercises.reduce((n, b) => n + b.sets.length, 0);
}
