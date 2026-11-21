// Local-time date helpers. Dates are plain `YYYY-MM-DD` strings so they serialize and compare lexicographically.
export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(date: Date): ISODate {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromISO(iso: ISODate): Date {
	const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function addDays(iso: ISODate, days: number): ISODate {
	const date = fromISO(iso);
	date.setDate(date.getDate() + days);
	return toISO(date);
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(iso: ISODate): number {
	return (fromISO(iso).getDay() + 6) % 7;
}

export function mondayOf(iso: ISODate): ISODate {
	return addDays(iso, -weekdayIndex(iso));
}

export function daysBetween(from: ISODate, to: ISODate): number {
	return Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86_400_000);
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function formatDay(iso: ISODate): string {
	return fromISO(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatMonthDay(iso: ISODate): string {
	return fromISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatClock(totalSec: number): string {
	const s = Math.max(0, Math.round(totalSec));
	return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** ISO week key such as `2026-W47`, used to key weekly challenges. */
export function weekKey(iso: ISODate): string {
	const monday = fromISO(mondayOf(iso));
	const thursday = new Date(monday);
	thursday.setDate(monday.getDate() + 3);
	const yearStart = new Date(thursday.getFullYear(), 0, 1);
	const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
	return `${thursday.getFullYear()}-W${pad(week)}`;
}

/** Small deterministic PRNG so seeded demo data is stable between reloads. */
export function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
