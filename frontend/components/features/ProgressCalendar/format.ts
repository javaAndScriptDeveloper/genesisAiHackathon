import type { IsoDate } from "@/lib/progress/types";

// Engine dates are plain YYYY-MM-DD strings; format them as UTC midnight so the weekday never shifts.
const asDate = (iso: IsoDate): Date => new Date(`${iso}T00:00:00Z`);

export function fmtMonth(month: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(asDate(`${month}-01`));
}

/** "Mon 16 Nov" style label for aria and sheet titles. */
export function fmtDay(iso: IsoDate, locale: string): string {
	return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(asDate(iso));
}

export function fmtShort(iso: IsoDate, locale: string): string {
	return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(asDate(iso));
}

export function fmtWeekdays(locale: string): string[] {
	const f = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
	// 2026-11-16 is a Monday.
	return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2026, 10, 16 + i))));
}

export function fmtPct(weight: number, locale: string): string {
	return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(weight * 100);
}
