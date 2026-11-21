import { clampText, sanitizeRecordText } from "./safeText";
import type { PersonalRecord } from "../progress/records";
import { daysBetween, type ISODate } from "./dates";
import type { PhotoCheckIn, PhotoInsight } from "./types";

export interface PhotoPair {
	before: PhotoCheckIn;
	after: PhotoCheckIn;
}

export interface InsightContext {
	weightChangeKg: number | null;
	consistency: number | null;
	streakWeeks: number;
	records: { exercise: string; text: string }[];
	periodDays: number;
}

/** Orders two photos by date (earlier first). Null when both share a day: the server needs before < after. */
export function orderPair(a: PhotoCheckIn, b: PhotoCheckIn): PhotoPair | null {
	if (a.date === b.date) return null;
	return a.date < b.date ? { before: a, after: b } : { before: b, after: a };
}

/** Earliest and latest photo by date. Null with fewer than two distinct dates. */
export function defaultPair(photos: PhotoCheckIn[]): PhotoPair | null {
	if (photos.length < 2) return null;
	const sorted = [...photos].sort((a, b) => a.date.localeCompare(b.date));
	const first = sorted[0];
	const last = sorted[sorted.length - 1];
	return first && last ? orderPair(first, last) : null;
}

function weightOn(photo: PhotoCheckIn, weights: { date: ISODate; kg: number }[]): number | null {
	if (photo.weightKg !== undefined) return photo.weightKg;
	const onOrBefore = weights.filter((w) => w.date <= photo.date).sort((a, b) => a.date.localeCompare(b.date));
	const hit = onOrBefore[onOrBefore.length - 1];
	return hit ? hit.kg : null;
}

export interface ContextInput {
	pair: PhotoPair;
	bodyWeights: { date: ISODate; kg: number }[];
	consistency: number | null;
	streakWeeks: number;
	records: PersonalRecord[];
	exerciseName: (id: string) => string;
}

const METRIC_TEXT: Record<PersonalRecord["metric"], (v: number) => string> = {
	weight: (v) => `heaviest set ${v} kg`,
	e1rm: (v) => `estimated 1RM ${v} kg`,
	reps: (v) => `${v} reps in a set`,
	time: (v) => `${v} s hold`,
};

export function buildContext({ pair, bodyWeights, consistency, streakWeeks, records, exerciseName }: ContextInput): InsightContext {
	const a = weightOn(pair.before, bodyWeights);
	const b = weightOn(pair.after, bodyWeights);
	const weightChangeKg = a !== null && b !== null ? Math.round((b - a) * 10) / 10 : null;
	const inPeriod = records
		.filter((r) => r.date >= pair.before.date && r.date <= pair.after.date)
		.sort((x, y) => y.date.localeCompare(x.date))
		.slice(0, 5)
		.map((r) => ({ exercise: sanitizeRecordText(exerciseName(r.exerciseId)), text: sanitizeRecordText(METRIC_TEXT[r.metric](r.value)) }))
		.filter((r) => r.exercise !== "" && r.text !== "");
	return { weightChangeKg, consistency, streakWeeks, records: inPeriod, periodDays: daysBetween(pair.before.date, pair.after.date) };
}

export interface Gating {
	showButton: boolean;
	premiumGate: boolean;
}

/** The first analysis is free; later ones need Premium. The button needs two photos. */
export function gating(photoCount: number, insightCount: number, premium: boolean): Gating {
	return { showButton: photoCount >= 2, premiumGate: insightCount > 0 && !premium };
}

export function toInsight(args: { id: string; now: string; pair: PhotoPair; model: string; engineVersion: string; result: PhotoInsight["result"] & { suitable: boolean } }): PhotoInsight {
	const { suitable, ...raw } = args.result;
	// Caps of the backend sync schema: one long result must never block /progress/sync.
	const result = {
		summary: clampText(raw.summary, 2000),
		observations: raw.observations.map((o) => ({ area: clampText(o.area, 200), text: clampText(o.text, 1000) })),
		encouragement: clampText(raw.encouragement, 1000),
	};
	return {
		id: args.id,
		analyzedAt: args.now,
		beforeDate: args.pair.before.date,
		afterDate: args.pair.after.date,
		beforeWeightKg: args.pair.before.weightKg ?? null,
		afterWeightKg: args.pair.after.weightKg ?? null,
		model: args.model,
		engineVersion: args.engineVersion,
		suitable,
		result,
	};
}
