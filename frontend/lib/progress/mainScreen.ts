// Pure selection helpers for the main Progress screen. They only pick and order what the engine already computed.
import type { WeekGoalDay } from "./consistency";
import { addDays } from "./dates";
import type { Advice } from "./improvements";
import type { PersonalRecord } from "./records";
import type { IsoDate, ProgressEvent } from "./types";

/** The refId of a "pr" event for this record (same key as `detectEvents`). */
export const prEventKey = (r: Pick<PersonalRecord, "exerciseId" | "metric" | "date">): string => `${r.exerciseId}:${r.metric}:${r.date}`;

/** The `n` records to show: unseen ("new") ones first, then the most recent; one card per exercise; stable on ties. */
export function newRecords(records: PersonalRecord[], events: ProgressEvent[], n: number): { record: PersonalRecord; isNew: boolean }[] {
	const unseenKeys = new Set(events.filter((e) => e.kind === "pr" && e.seenAt === null).map((e) => e.refId));
	return records
		.map((record, i) => ({ record, isNew: unseenKeys.has(prEventKey(record)), i }))
		.sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.record.date.localeCompare(a.record.date) || a.i - b.i)
		.filter((x, idx, all) => all.findIndex((y) => y.record.exerciseId === x.record.exerciseId) === idx)
		.slice(0, Math.max(0, n))
		.map(({ record, isNew }) => ({ record, isNew }));
}

export type WeekDayState = "done" | "rest" | "today" | "upcoming" | "missed";

/** Display state of each day of the weekly-goal strip. A done workout wins over "today". */
export function weekDayStates(days: WeekGoalDay[], today: IsoDate): { date: IsoDate; state: WeekDayState }[] {
	return days.map(({ date, type, status }) => {
		if (status === "completed" || status === "adapted") return { date, state: "done" };
		if (date === today) return { date, state: "today" };
		if (type === "rest" || status === "rest" || status === "none") return { date, state: "rest" };
		if (status === "missed") return { date, state: "missed" };
		return { date, state: date < today ? "missed" : "upcoming" };
	});
}

/**
 * Monday of the newest unseen weekly report, while the card may still hang: the report of week W is shown
 * until the Sunday of the following week (W + 13 days), never longer.
 */
export function unseenReportWeek(events: ProgressEvent[], today: IsoDate): IsoDate | null {
	const weeks = events
		.filter((e) => e.kind === "report" && e.seenAt === null && /^\d{4}-\d{2}-\d{2}$/.test(e.refId) && today <= addDays(e.refId, 13))
		.map((e) => e.refId)
		.sort();
	return weeks.at(-1) ?? null;
}

/** consistencyV2 weeks (newest first) as bars, oldest to newest left to right. */
export function consistencyBars<T extends { weekStart: IsoDate }>(weeks: T[]): T[] {
	return [...weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** The button under "What next": start the next planned workout when there is one, else open the calendar. */
export function mainAction(advice: Advice | null, hasPlannedWorkout: boolean): "start" | "calendar" | null {
	if (!advice) return null;
	return hasPlannedWorkout ? "start" : "calendar";
}
