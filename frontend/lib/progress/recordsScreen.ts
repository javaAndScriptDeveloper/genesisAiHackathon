import { addDays, daysBetween } from "./dates";
import { estimate1RM, exerciseSeries, mainMetric } from "./records";
import type { PersonalRecord, RecordMetric, SeriesPoint } from "./records";
import type { Exercise, History, IsoDate } from "./types";

export type RecordsFilter = "all" | "weighted" | "bodyweight";
export type ChartPeriod = "4w" | "3m" | "year";

export const PERIOD_DAYS: Record<ChartPeriod, number> = { "4w": 28, "3m": 91, year: 365 };
/** Periods longer than the free history window are Premium. */
export const FREE_PERIOD_DAYS = 91;

export const isLockedPeriod = (period: ChartPeriod, premium: boolean): boolean => !premium && PERIOD_DAYS[period] > FREE_PERIOD_DAYS;

/** Points inside the last `days` days (inclusive of today). */
export function pointsInPeriod(points: SeriesPoint[], today: IsoDate, days: number): SeriesPoint[] {
	const from = addDays(today, -days);
	return points.filter((p) => p.date >= from && p.date <= today);
}

export function matchesFilter(kind: Exercise["kind"], filter: RecordsFilter): boolean {
	if (filter === "all") return true;
	return filter === "weighted" ? kind === "weighted" : kind !== "weighted";
}

export interface RecordRow {
	key: string;
	exerciseId: string;
	name: string;
	metric: RecordMetric;
	value: number;
	previous: number;
	gain: number;
	date: IsoDate;
	isNew: boolean;
}

/** The pr event refId used by lib/progress/events. */
export const recordKey = (r: Pick<PersonalRecord, "exerciseId" | "metric" | "date">): string => `${r.exerciseId}:${r.metric}:${r.date}`;

/** Records of the filtered exercises, newest first (ties: bigger gain first), flagged when their pr event is unseen. */
export function recordRows(h: History, records: PersonalRecord[], filter: RecordsFilter, freshKeys: ReadonlySet<string>): RecordRow[] {
	const byId = new Map(h.exercises.map((e) => [e.id, e]));
	return records
		.flatMap((r) => {
			const ex = byId.get(r.exerciseId);
			if (!ex || !matchesFilter(ex.kind, filter)) return [];
			const key = recordKey(r);
			return [{ key, exerciseId: r.exerciseId, name: ex.name, metric: r.metric, value: r.value, previous: r.previous, gain: Math.round((r.value - r.previous) * 10) / 10, date: r.date, isNew: freshKeys.has(key) }];
		})
		.sort((a, b) => (a.date === b.date ? b.gain - a.gain : b.date.localeCompare(a.date)));
}

export interface ExerciseOption {
	id: string;
	name: string;
	kind: Exercise["kind"];
}

/** Exercises with at least one point of the main metric, most recently trained first. */
export function recordExercises(h: History, filter: RecordsFilter): ExerciseOption[] {
	return h.exercises
		.filter((e) => matchesFilter(e.kind, filter))
		.flatMap((e) => {
			const series = exerciseSeries(h, e.id);
			const last = series[series.length - 1];
			return last ? [{ option: { id: e.id, name: e.name, kind: e.kind }, last: last.date }] : [];
		})
		.sort((a, b) => b.last.localeCompare(a.last) || a.option.name.localeCompare(b.option.name))
		.map((x) => x.option);
}

/** Keeps a wanted exercise when it is available in the filter, otherwise the first one (or null). */
export function pickExercise(options: ExerciseOption[], wanted: string | null): string | null {
	return options.find((o) => o.id === wanted)?.id ?? options[0]?.id ?? null;
}

export interface FormulaExample {
	weightKg: number;
	reps: number;
	e1rmKg: number;
	date: IsoDate;
}

/** The set that gives the best Brzycki estimate (1..10 reps) in completed sessions; null when none qualifies. */
export function bestFormulaSet(h: History, exerciseId: string): FormulaExample | null {
	let best: FormulaExample | null = null;
	for (const s of h.sessions) {
		if (s.status !== "completed") continue;
		for (const set of s.sets) {
			if (set.exerciseId !== exerciseId || set.weightKg === null) continue;
			const e = estimate1RM(set.weightKg, set.reps);
			if (e === null) continue;
			if (!best || e > best.e1rmKg || (e === best.e1rmKg && s.date < best.date)) best = { weightKg: set.weightKg, reps: set.reps, e1rmKg: e, date: s.date };
		}
	}
	return best;
}

/** Display parameters for "{weight} × {reps} → ≈ {e1rm}"; masses are converted by the caller's unit formatter. */
export function formulaParams(ex: FormulaExample, mass: (kg: number, decimals: number) => string): { weight: string; reps: number; e1rm: string } {
	return { weight: mass(ex.weightKg, 0), reps: ex.reps, e1rm: mass(ex.e1rmKg, 1) };
}

/** Metric actually plotted for an exercise: the main one, except weighted exercises without a qualifying set use max weight. */
export function plottedMetric(h: History, exerciseId: string): RecordMetric | null {
	const kind = h.exercises.find((e) => e.id === exerciseId)?.kind;
	if (!kind) return null;
	const main = mainMetric(kind);
	return main === "e1rm" && !bestFormulaSet(h, exerciseId) ? "weight" : main;
}

// ---- chart geometry (pure so the tap/drag logic is testable) ----

export interface ChartBox {
	width: number;
	height: number;
	padX: number;
	padY: number;
}

/** X for each point, spread by date (not by index); a single point sits in the middle. */
export function pointXs(dates: IsoDate[], box: ChartBox): number[] {
	const first = dates[0];
	const last = dates[dates.length - 1];
	if (first === undefined || last === undefined) return [];
	const span = daysBetween(first, last);
	const inner = box.width - box.padX * 2;
	return dates.map((d) => (span === 0 ? box.padX + inner / 2 : box.padX + (daysBetween(first, d) / span) * inner));
}

export function pointYs(values: number[], box: ChartBox): number[] {
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min;
	const inner = box.height - box.padY * 2;
	return values.map((v) => (span === 0 ? box.padY + inner / 2 : box.padY + (1 - (v - min) / span) * inner));
}

/** Index of the point nearest to x (in the same coordinates as `xs`); -1 for no points. */
export function pickPointIndex(xs: number[], x: number): number {
	let best = -1;
	let bestDist = Infinity;
	xs.forEach((px, i) => {
		const d = Math.abs(px - x);
		if (d < bestDist) {
			best = i;
			bestDist = d;
		}
	});
	return best;
}

/** Converts a pointer position (client px) to viewBox x. */
export const clientToViewX = (clientX: number, left: number, widthPx: number, viewWidth: number): number => (widthPx <= 0 ? 0 : ((clientX - left) / widthPx) * viewWidth);

/** Change over the visible points: last minus first (0 with fewer than two). */
export function periodChange(points: SeriesPoint[]): number {
	const first = points[0];
	const last = points[points.length - 1];
	return first && last && points.length > 1 ? Math.round((last.value - first.value) * 10) / 10 : 0;
}
