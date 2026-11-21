import { exerciseSeries, mainMetric, personalRecords } from "./records";
import type { PersonalRecord, RecordMetric, SeriesPoint } from "./records";
import type { History } from "./types";

export interface ExerciseProgressView {
	metric: RecordMetric | null;
	/** Last 8 points, oldest first. */
	points: SeriesPoint[];
	best: number | null;
	/** Last 3 records on the main metric, newest first. */
	records: PersonalRecord[];
}

const MAX_POINTS = 8;
const MAX_RECORDS = 3;

export function exerciseProgressView(h: History, exerciseId: string): ExerciseProgressView {
	const kind = h.exercises.find((e) => e.id === exerciseId)?.kind;
	if (!kind) return { metric: null, points: [], best: null, records: [] };
	const metric = mainMetric(kind);
	const series = exerciseSeries(h, exerciseId);
	const records = personalRecords(h)
		.filter((r) => r.exerciseId === exerciseId && r.metric === metric)
		.reverse()
		.slice(0, MAX_RECORDS);
	return { metric, points: series.slice(-MAX_POINTS), best: series.length ? Math.max(...series.map((p) => p.value)) : null, records };
}
