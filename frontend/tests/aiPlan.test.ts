import { afterEach, describe, expect, it } from "vitest";
import { AiConfigError } from "@/lib/ai/errors";
import { askJson } from "@/lib/ai/planner";
import { coachAiReplySchema } from "@/lib/fit/aiPlan";
import { systemFor, weekPrompt } from "@/lib/fit/aiPrompts";
import { z } from "zod";
import { statsSummary, statusForReadiness, type DailyStats } from "@/lib/fit/dailyStats";
import { aiWeekSchema, buildDailySession, buildPlanFromAi, diffPlans, exerciseCatalog, fallbackDaily } from "@/lib/fit/aiPlan";
import { getExercise } from "@/lib/fit/exercises";
import { generatePlan } from "@/lib/fit/plan";
import { emptyState } from "@/lib/fit/seed";
import { reducer } from "@/lib/fit/store/reducer";
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

describe("AI plan conversion", () => {
	const alex: Profile = {
		name: "Alex", age: 30, gender: null, heightCm: 178, weightKg: 80, goal: "build-muscle", experience: "intermediate",
		location: "home", equipment: ["dumbbells", "bench"], durationMin: 45, daysPerWeek: 3, limitations: [], limitationNote: "", wearable: "none",
	};
	const today = "2026-11-25"; // Wednesday
	const ex = (exerciseId: string, extra: Partial<{ sets: number; reps: number; seconds: number; restSec: number }> = {}) => ({ exerciseId, sets: 3, reps: 10, restSec: 60, ...extra });
	const good = (weekday: number) => ({ weekday, title: "Day", focus: "Mix", exercises: [ex("goblet-squat"), ex("db-row"), ex("plank", { seconds: 30 })] });
	const week = (sessions: ReturnType<typeof good>[]) => ({ summary: "s", why: [], sessions });

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

describe("aiPrompts", () => {
	const bare: Profile = { ...profile, location: "home", equipment: [], limitations: ["knees"] };
	it("exerciseCatalog excludes equipment and knee-stressing moves", () => {
		const list = exerciseCatalog(bare);
		expect(list.length).toBeGreaterThan(0);
		for (const item of list) {
			const ex = getExercise(item.id);
			expect(ex.equipment).toEqual([]);
			expect(ex.stresses).not.toContain("knees");
		}
	});
	it("weekPrompt carries sessions, ids, wishes and stats", () => {
		const stats = [stat("2026-11-20", 70), stat("2026-11-21", 55)];
		const text = weekPrompt({ profile: bare, stats, wishes: ["more core", "no burpees"] });
		expect(text).toContain("3 sessions");
		for (const item of exerciseCatalog(bare)) expect(text).toContain(item.id);
		expect(text).toContain("more core");
		expect(text).toContain("no burpees");
		expect(text).toContain(statsSummary(stats));
	});
	it("weekPrompt asks for the why list and uses the person's own goal words (ported from the team's /api/plan prompt)", () => {
		const text = weekPrompt({ profile: { ...bare, goalText: "run a 10k in spring" }, stats: [], wishes: [] });
		expect(text).toContain("run a 10k in spring");
		expect(text).toContain('"why"');
		expect(text).toMatch(/Dose by goal and level/);
	});
	it("systemFor includes the tone of voice", () => {
		expect(systemFor({ name: "Rex", tov: "gruff but kind" })).toContain("gruff but kind");
	});
});

describe("coachAiReplySchema", () => {
	it("rejects out-of-range days and accepts null rebuild", () => {
		const bad = { reply: "ok", rebuild: { wishes: [], profileChanges: { daysPerWeek: 9 }, summary: "s" } };
		expect(coachAiReplySchema.safeParse(bad).success).toBe(false);
		expect(coachAiReplySchema.safeParse({ reply: "ok", rebuild: null }).success).toBe(true);
	});
});

describe("askJson", () => {
	const saved = process.env.GEMINI_API_KEY;
	afterEach(() => {
		if (saved === undefined) delete process.env.GEMINI_API_KEY;
		else process.env.GEMINI_API_KEY = saved;
	});
	it("throws AiConfigError without a key", async () => {
		delete process.env.GEMINI_API_KEY;
		await expect(askJson(z.object({ a: z.string() }), { system: "s", prompt: "p" })).rejects.toBeInstanceOf(AiConfigError);
	});
});

describe("aiWeekSchema", () => {
	it("defaults a missing why list and caps it at five", () => {
		const base = { summary: "s", sessions: [] };
		expect(aiWeekSchema.parse(base).why).toEqual([]);
		expect(aiWeekSchema.safeParse({ ...base, why: ["a", "b", "c", "d", "e", "f"] }).success).toBe(false);
	});
});

describe("complete-onboarding with a prebuilt plan", () => {
	const alex: Profile = { ...profile, name: "Alex", equipment: ["dumbbells"], durationMin: 45 };
	const today = "2026-11-25";
	const planned = generatePlan(alex, today, 4).map((w) => ({ ...w, title: `AI ${w.title}` }));
	it("stores the given plan and who built it, keeping the progress token the backend user was saved under", () => {
		const token = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
		const s = reducer(emptyState(), { type: "complete-onboarding", profile: alex, units: "metric", demoHistory: false, today, now: "2026-11-25T08:00:00.000Z", planned, ai: { backend: { deviceId: 9 }, summary: "Hi Alex", source: "ai", progressToken: token } });
		expect(s.planned).toEqual(planned);
		expect(s.backend).toEqual({ deviceId: 9 });
		expect(s.planSource).toBe("ai");
		expect(s.planSummary).toBe("Hi Alex");
		expect(s.progressToken).toBe(token);
	});
	it("keeps demo history in the past and the given plan from today", () => {
		const s = reducer(emptyState(), { type: "complete-onboarding", profile: alex, units: "metric", demoHistory: true, today, now: "2026-11-25T08:00:00.000Z", planned });
		expect(s.planned.filter((w) => w.date >= today)).toEqual(planned);
		expect(s.history.length).toBeGreaterThan(0);
		expect(s.planSource).toBe("rules");
	});
});
