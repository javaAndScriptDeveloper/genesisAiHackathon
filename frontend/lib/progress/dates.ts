import type { IsoDate } from "./types";

const DAY_MS = 86_400_000;

function toUtc(d: IsoDate): Date {
	return new Date(`${d}T00:00:00Z`);
}

function fromUtc(date: Date): IsoDate {
	return date.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(d: IsoDate): number {
	return (toUtc(d).getUTCDay() + 6) % 7;
}

export function addDays(d: IsoDate, n: number): IsoDate {
	return fromUtc(new Date(toUtc(d).getTime() + n * DAY_MS));
}

export function weekStart(d: IsoDate): IsoDate {
	return addDays(d, -weekday(d));
}

/** b − a in days. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
	return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / DAY_MS);
}

/** Inclusive range of dates. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
	const n = daysBetween(from, to);
	return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(from, i));
}
