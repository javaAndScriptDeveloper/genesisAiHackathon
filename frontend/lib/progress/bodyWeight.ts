import { addDays } from "./dates";
import type { BodyMeasurement, IsoDate } from "./types";

export type BmiCategory = "under" | "normal" | "over" | "obese";
export type WeightPeriod = "month" | "3m" | "year";

const r1 = (n: number) => Math.round(n * 10) / 10;
const byDate = (a: BodyMeasurement, b: BodyMeasurement) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Per measured date: mean of all entries in the `days` calendar days ending that date (inclusive). */
export function movingAverage(entries: BodyMeasurement[], days: 7): { date: IsoDate; avg: number }[] {
	const sorted = [...entries].sort(byDate);
	const dates = [...new Set(sorted.map((e) => e.date))];
	return dates.map((date) => {
		const from = addDays(date, -(days - 1));
		const win = sorted.filter((e) => e.date >= from && e.date <= date);
		return { date, avg: r1(win.reduce((s, e) => s + e.weightKg, 0) / win.length) };
	});
}

const WINDOW_DAYS: Record<WeightPeriod, number> = { month: 30, "3m": 91, year: 365 };

export function weightSummary(
	entries: BodyMeasurement[],
	period: WeightPeriod,
	today: IsoDate,
): { start: number | null; current: number | null; change: number | null; points: BodyMeasurement[]; avg: { date: IsoDate; avg: number }[] } {
	const from = addDays(today, -(WINDOW_DAYS[period] - 1));
	const points = entries.filter((e) => e.date >= from && e.date <= today).sort(byDate);
	const first = points[0];
	const last = points[points.length - 1];
	if (!first || !last) return { start: null, current: null, change: null, points: [], avg: [] };
	const avg = movingAverage(entries, 7).filter((a) => a.date >= from && a.date <= today);
	return { start: first.weightKg, current: last.weightKg, change: r1(last.weightKg - first.weightKg), points, avg };
}

/** Returns null for non-positive / non-finite inputs. */
export function bmi(kg: number, heightCm: number): { value: number; category: BmiCategory } | null {
	if (!(kg > 0) || !(heightCm > 0) || !Number.isFinite(kg) || !Number.isFinite(heightCm)) return null;
	const m = heightCm / 100;
	const raw = kg / (m * m);
	const value = r1(raw); // category from the displayed (rounded) value so they always agree
	const category: BmiCategory = value < 18.5 ? "under" : value < 25 ? "normal" : value < 30 ? "over" : "obese";
	return { value, category };
}
