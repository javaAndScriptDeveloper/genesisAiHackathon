import { addDays, weekday } from "./dates";
import { weeklyGoal, type WeekGoal } from "./consistency";
import { insights, type Insight } from "./insights";
import { personalRecords, type PersonalRecord } from "./records";
import { periodSummary, type PeriodSummary } from "./summary";
import type { History, IsoDate } from "./types";

export interface WeeklyReport {
	summary: PeriodSummary;
	previous: PeriodSummary;
	records: PersonalRecord[];
	insight: Insight | null;
	nextWeek: WeekGoal;
}

/** A report week is a real Monday whose Sunday is already in the past. */
export function isValidReportWeek(week: string, today: IsoDate): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return false;
	const d = new Date(`${week}T00:00:00Z`);
	if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== week) return false;
	return weekday(week) === 0 && addDays(week, 6) < today;
}

export function weeklyReport(h: History, week: IsoDate): WeeklyReport {
	const end = addDays(week, 6);
	const prev = addDays(week, -7);
	return {
		summary: periodSummary(h, week, end),
		previous: periodSummary(h, prev, addDays(prev, 6)),
		records: personalRecords(h).filter((r) => r.date >= week && r.date <= end),
		// consistency_up uses a different metric than the app's consistency ring, so it is left out of reports.
		insight: insights({ ...h, today: end }, 4).find((i) => i.id !== "consistency_up") ?? null,
		nextWeek: weeklyGoal(h, addDays(week, 7)),
	};
}
