import { describe, expect, it } from "vitest";
import { scenarioState } from "@/lib/fit/scenarios";
import { progressOf } from "@/lib/fit/store/progressStats";
import type { WeekGoalDay } from "@/lib/progress/consistency";
import { consistencyBars, formatRecordValue, mainAction, newRecords, prEventKey, seriesMetric, unseenReportWeek, weekDayStates, type RecordFormat } from "@/lib/progress/mainScreen";
import type { PersonalRecord } from "@/lib/progress/records";
import type { ProgressEvent } from "@/lib/progress/types";

const rec = (exerciseId: string, date: string, metric: PersonalRecord["metric"] = "e1rm"): PersonalRecord => ({ exerciseId, metric, value: 50, previous: 45, date, sessionId: `s-${exerciseId}-${date}` });
const ev = (kind: ProgressEvent["kind"], refId: string, seen = false): ProgressEvent => ({ id: `${kind}:${refId}`, kind, refId, createdAt: "2026-11-20T10:00:00.000Z", seenAt: seen ? "2026-11-20T11:00:00.000Z" : null });

describe("newRecords", () => {
	it("returns nothing for an empty history", () => {
		expect(newRecords([], [], 2)).toEqual([]);
	});

	it("takes the 2 most recent records, newest first", () => {
		const list = [rec("a", "2026-11-01"), rec("b", "2026-11-10"), rec("c", "2026-11-05")];
		expect(newRecords(list, [], 2).map((r) => r.record.exerciseId)).toEqual(["b", "c"]);
		expect(newRecords(list, [], 2).every((r) => !r.isNew)).toBe(true);
	});

	it("puts unseen pr events first and marks them new", () => {
		const list = [rec("a", "2026-11-01"), rec("b", "2026-11-10"), rec("c", "2026-11-05")];
		const events = [ev("pr", prEventKey(list[0]!)), ev("pr", prEventKey(list[1]!), true)];
		const out = newRecords(list, events, 2);
		expect(out.map((r) => [r.record.exerciseId, r.isNew])).toEqual([
			["a", true],
			["b", false],
		]);
	});

	it("ignores seen pr events and other kinds", () => {
		const list = [rec("a", "2026-11-01"), rec("b", "2026-11-10")];
		const out = newRecords(list, [ev("badge", prEventKey(list[0]!)), ev("pr", prEventKey(list[0]!), true)], 1);
		expect(out.map((r) => r.record.exerciseId)).toEqual(["b"]);
	});

	it("shows one card per exercise", () => {
		const list = [rec("a", "2026-11-10", "weight"), rec("a", "2026-11-10", "e1rm"), rec("b", "2026-11-01")];
		expect(newRecords(list, [], 2).map((r) => `${r.record.exerciseId}:${r.record.metric}`)).toEqual(["a:weight", "b:e1rm"]);
	});

	it("breaks a date tie by input order (stable)", () => {
		const list = [rec("a", "2026-11-10"), rec("b", "2026-11-10")];
		expect(newRecords(list, [], 2).map((r) => r.record.exerciseId)).toEqual(["a", "b"]);
	});
});

describe("weekDayStates", () => {
	const day = (date: string, type: WeekGoalDay["type"], status: WeekGoalDay["status"]): WeekGoalDay => ({ date, type, status });
	it("maps engine days to done / rest / today / upcoming / missed", () => {
		const days = [
			day("2026-11-16", "workout", "completed"),
			day("2026-11-17", "rest", "rest"),
			day("2026-11-18", "workout", "adapted"),
			day("2026-11-19", "workout", "missed"),
			day("2026-11-20", "rest", "none"),
			day("2026-11-21", "workout", "planned"),
			day("2026-11-22", "workout", "planned"),
		];
		expect(weekDayStates(days, "2026-11-21").map((d) => d.state)).toEqual(["done", "rest", "done", "missed", "rest", "today", "upcoming"]);
	});

	it("shows a done workout today as done, a rest day today as today", () => {
		expect(weekDayStates([day("2026-11-21", "workout", "completed")], "2026-11-21")[0]?.state).toBe("done");
		expect(weekDayStates([day("2026-11-21", "rest", "rest")], "2026-11-21")[0]?.state).toBe("today");
	});
});

describe("unseenReportWeek", () => {
	it("is null without an unseen report event", () => {
		expect(unseenReportWeek([], "2026-11-21")).toBeNull();
		expect(unseenReportWeek([ev("report", "2026-11-09", true)], "2026-11-21")).toBeNull();
	});
	it("returns the week while it is still the following week", () => {
		expect(unseenReportWeek([ev("report", "2026-11-09")], "2026-11-16")).toBe("2026-11-09");
		expect(unseenReportWeek([ev("report", "2026-11-09")], "2026-11-22")).toBe("2026-11-09");
	});
	it("expires after the Sunday of the following week", () => {
		expect(unseenReportWeek([ev("report", "2026-11-09")], "2026-11-23")).toBeNull();
	});
	it("picks the newest unseen report", () => {
		expect(unseenReportWeek([ev("report", "2026-11-02"), ev("report", "2026-11-09")], "2026-11-17")).toBe("2026-11-09");
	});
});

describe("consistencyBars", () => {
	it("orders the engine weeks oldest to newest", () => {
		const weeks = [
			{ weekStart: "2026-11-09", score: 100, weight: 0.4 },
			{ weekStart: "2026-11-02", score: 50, weight: 0.3 },
		];
		expect(consistencyBars(weeks).map((w) => w.weekStart)).toEqual(["2026-11-02", "2026-11-09"]);
	});
});

describe("mainAction", () => {
	it("starts a workout when one is planned, otherwise opens the calendar", () => {
		expect(mainAction({ id: "goal-remaining", vars: { n: 1 } }, true)).toBe("start");
		expect(mainAction({ id: "plateau", vars: {} }, false)).toBe("calendar");
		expect(mainAction(null, true)).toBeNull();
	});
	it("never repeats the goal card's Start button for the 'start' advice", () => {
		expect(mainAction({ id: "start", vars: {} }, true)).toBe("calendar");
	});
});

describe("formatRecordValue", () => {
	const f: RecordFormat = { load: (kg) => `${kg} kg`, reps: (n) => `${n} reps`, time: (s) => `${s} s`, estimate: (x) => `≈ ${x}` };
	it("marks every e1RM value as an estimate", () => {
		expect(formatRecordValue("e1rm", 36, f)).toBe("≈ 36 kg");
	});
	it("leaves weight, reps and time plain", () => {
		expect(formatRecordValue("weight", 32, f)).toBe("32 kg");
		expect(formatRecordValue("reps", 18, f)).toBe("18 reps");
		expect(formatRecordValue("time", 45, f)).toBe("45 s");
	});
});

describe("seriesMetric", () => {
	it("uses e1RM for weighted work only when an e1RM record exists", () => {
		expect(seriesMetric("weighted", [{ exerciseId: "a", metric: "e1rm" }], "a")).toBe("e1rm");
		expect(seriesMetric("weighted", [{ exerciseId: "a", metric: "weight" }], "a")).toBe("weight");
		expect(seriesMetric("bodyweight", [], "b")).toBe("reps");
		expect(seriesMetric("timed", [], "c")).toBe("time");
	});
});

describe("scenarios", () => {
	const today = "2026-11-21";
	it("S0: no records, no report card, every day upcoming / rest / today", () => {
		const s = scenarioState("S0", today);
		const p = progressOf(s, today);
		expect(newRecords(p.records, s.progressEvents, 2)).toEqual([]);
		expect(unseenReportWeek(s.progressEvents, today)).toBeNull();
		const states = weekDayStates(p.week.days, today).map((d) => d.state);
		expect(states).not.toContain("done");
		expect(p.consistency.score).toBeNull();
	});
	it("S2: 2 records with the unseen ones first, and an unseen report", () => {
		const s = scenarioState("S2", today);
		const p = progressOf(s, today);
		const out = newRecords(p.records, s.progressEvents, 2);
		expect(out).toHaveLength(2);
		const flags = out.map((r) => r.isNew);
		expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
		expect(unseenReportWeek(s.progressEvents, today)).not.toBeNull();
	});
});
