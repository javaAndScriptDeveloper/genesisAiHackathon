import { bmi, weightSummary, type BmiCategory, type WeightPeriod } from "./bodyWeight";
import { daysBetween } from "./dates";
import { visibleHistoryFrom } from "./premium";
import type { BodyMeasurement, IsoDate } from "./types";

export const WEIGHT_PERIODS: readonly WeightPeriod[] = ["month", "3m", "year"];
const PERIOD_DAYS: Record<WeightPeriod, number> = { month: 30, "3m": 91, year: 365 };

export interface WeightPoint {
	date: IsoDate;
	kg: number;
}

export interface WeightSeries {
	from: IsoDate;
	to: IsoDate;
	/** Weigh-ins in the period, oldest first. */
	dots: WeightPoint[];
	/** 7-day moving average at each weighed date. */
	line: WeightPoint[];
	/** Padded y-domain in kg (includes the goal when given). */
	min: number;
	max: number;
}

const firstDay = (today: IsoDate, period: WeightPeriod): IsoDate => {
	const d = new Date(`${today}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - (PERIOD_DAYS[period] - 1));
	return d.toISOString().slice(0, 10);
};

/** Chart series for one period; entries older than the free-history limit are dropped for non-Premium users. */
export function buildWeightSeries(entries: BodyMeasurement[], period: WeightPeriod, today: IsoDate, premium: boolean, goalKg: number | null = null): WeightSeries | null {
	const limit = visibleHistoryFrom(today, premium);
	const visible = limit ? entries.filter((e) => e.date >= limit) : entries;
	const s = weightSummary(visible, period, today);
	if (s.points.length === 0) return null;
	const dots = s.points.map((p) => ({ date: p.date, kg: p.weightKg }));
	const line = s.avg.map((a) => ({ date: a.date, kg: a.avg }));
	const all = [...dots.map((d) => d.kg), ...line.map((l) => l.kg), ...(goalKg ? [goalKg] : [])];
	const lo = Math.min(...all);
	const hi = Math.max(...all);
	const pad = Math.max(0.5, (hi - lo) * 0.15);
	return { from: firstDay(today, period), to: today, dots, line, min: lo - pad, max: hi + pad };
}

/** Whole-day offset of a date inside the series range (0 = first day of the period). */
export const dayOffset = (series: Pick<WeightSeries, "from">, d: IsoDate): number => daysBetween(series.from, d);

/** Nearest weigh-in to a horizontal fraction (0..1) of the chart; ties go to the earlier one. */
export function nearestDot(series: WeightSeries, fraction: number): WeightPoint | null {
	const span = Math.max(1, daysBetween(series.from, series.to));
	const target = Math.min(1, Math.max(0, fraction)) * span;
	let best: WeightPoint | null = null;
	let bestDist = Infinity;
	for (const p of series.dots) {
		const dist = Math.abs(dayOffset(series, p.date) - target);
		if (dist < bestDist) {
			best = p;
			bestDist = dist;
		}
	}
	return best;
}

/** BMI scale: four equal segments (under / normal / over / obese) with WHO boundaries 18.5 / 25 / 30, ends 15 and 40. */
export const BMI_SEGMENTS: { category: BmiCategory; from: number; to: number }[] = [
	{ category: "under", from: 15, to: 18.5 },
	{ category: "normal", from: 18.5, to: 25 },
	{ category: "over", from: 25, to: 30 },
	{ category: "obese", from: 30, to: 40 },
];

/** Marker position 0..1 along the scale (clamped). Each segment owns a quarter of the width. */
export function bmiMarker(value: number): number {
	const idx = BMI_SEGMENTS.findIndex((s, i) => value < s.to || i === BMI_SEGMENTS.length - 1);
	const seg = BMI_SEGMENTS[idx] ?? BMI_SEGMENTS[0];
	if (!seg) return 0;
	const within = Math.min(1, Math.max(0, (value - seg.from) / (seg.to - seg.from)));
	return (idx + within) / BMI_SEGMENTS.length;
}

export type WeightScreenState = "empty" | "single" | "trend";

export interface WeightScreenView {
	state: WeightScreenState;
	/** Year is Premium-only; the chart area shows the gate instead. */
	locked: boolean;
	series: WeightSeries | null;
	bmi: { value: number; category: BmiCategory; marker: number } | null;
}

/** All decisions of the screen in one pure place: empty states, the Premium gate and whether BMI shows. */
export function weightScreenView(entries: BodyMeasurement[], heightCm: number | null | undefined, period: WeightPeriod, today: IsoDate, premium: boolean, goalKg: number | null = null): WeightScreenView {
	const locked = period === "year" && !premium;
	const series = locked ? null : buildWeightSeries(entries, period, today, premium, goalKg);
	const latest = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
	const b = latest && heightCm ? bmi(latest.weightKg, heightCm) : null;
	const state: WeightScreenState = entries.length === 0 ? "empty" : entries.length === 1 || (series !== null && series.dots.length < 2) ? "single" : "trend";
	return { state, locked, series, bmi: b ? { ...b, marker: bmiMarker(b.value) } : null };
}

/** Locale-aware number with fixed decimals (uk uses a comma). */
export function formatWeight(value: number, locale: string, decimals = 1): string {
	return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
