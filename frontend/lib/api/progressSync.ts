import { z } from "zod";
import { toISO } from "../fit/dates";
import { findExercise } from "../fit/exercises";
import type { FitState, LoggedExercise, Perceived, PhotoInsight, SessionLog } from "../fit/types";
import { addDays, ENGINE_VERSION, progressSnapshot, snapshotHash, weekStart, type ProgressSnapshot } from "../progress";
import { historyFromFit } from "../progress/fromFit";
import type { ArchiveItem, IsoDate } from "../progress/types";

// Mirrors platform-backend/src/progress (routes.ts + repo.ts). Reached through the `/api/*` fallback rewrite.
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTime = z.string().min(1);
const nullableNum = z.number().nullable();

const setSchema = z.object({
	id: z.string().min(1),
	exerciseId: z.string().min(1),
	kind: z.enum(["weighted", "bodyweight", "timed"]),
	reps: nullableNum.optional(),
	weightKg: nullableNum.optional(),
	durationSec: nullableNum.optional(),
	completed: z.boolean(),
	performedAt: dateTime,
});

const workoutSchema = z.object({
	id: z.string().min(1),
	trainingId: z.number().nullable().optional(),
	planDate: date.nullable().optional(),
	performedOn: date,
	status: z.enum(["completed", "partial", "abandoned"]),
	plannedSets: z.number(),
	durationSec: z.number(),
	perceived: z.string().nullable().optional(),
	adapted: z.boolean(),
	adHoc: z.boolean(),
	sets: z.array(setSchema),
});

const photoInsightSchema = z.object({
	id: z.string().min(1),
	analyzedAt: dateTime,
	beforeDate: date,
	afterDate: date,
	beforePhotoId: z.string().max(100).nullish(),
	afterPhotoId: z.string().max(100).nullish(),
	beforeWeightKg: nullableNum,
	afterWeightKg: nullableNum,
	model: z.string().min(1),
	engineVersion: z.string().min(1),
	suitable: z.boolean(),
	result: z.object({
		summary: z.string(),
		observations: z.array(z.object({ area: z.string(), text: z.string() })).max(4),
		encouragement: z.string(),
	}),
});

export const remoteSnapshotSchema = z.object({
	settings: z.object({ weeklyGoal: z.number().int().min(2).max(5), units: z.enum(["metric", "imperial"]), heightCm: nullableNum.optional() }),
	planDays: z.array(z.object({ date, type: z.enum(["training", "rest"]), workoutRef: z.string().nullable().optional() })),
	workouts: z.array(workoutSchema),
	pauses: z.array(z.object({ id: z.string().min(1), fromDate: date, toDate: date })),
	weights: z.array(z.object({ date, kg: z.number() })),
	events: z.array(z.object({ id: z.string().min(1), kind: z.enum(["badge", "level", "pr", "report"]), refId: z.string(), payload: z.unknown().optional(), createdAt: dateTime, seenAt: dateTime.nullable().optional() })),
	checkIns: z.array(z.object({ id: z.string().min(1), kind: z.enum(["weight", "goal", "photo"]), date, takenAt: dateTime, weightKg: nullableNum.optional(), goalKg: nullableNum.optional() })),
	photoInsights: z.array(photoInsightSchema).optional(),
});
export type RemoteSnapshot = z.infer<typeof remoteSnapshotSchema>;
type RemoteWorkout = RemoteSnapshot["workouts"][number];

const noon = (d: string) => `${d}T12:00:00.000Z`;
const PERCEIVED: Perceived[] = ["easy", "right", "hard"];

/** The state that may leave the device: demo logs and demo weights are never synced or archived. */
export function syncableState(state: FitState): FitState {
	return {
		...state,
		history: state.history.filter((l) => !l.demo),
		bodyWeights: state.hasDemoHistory ? state.bodyWeights.filter((b) => b.at !== undefined) : state.bodyWeights,
	};
}

function workoutOf(state: FitState, log: SessionLog): RemoteWorkout {
	const plan = log.plannedId ? state.planned.find((w) => w.id === log.plannedId) : undefined;
	const sets: RemoteWorkout["sets"] = [];
	log.exercises.forEach((ex, ei) => {
		if (ex.skipped) return;
		const info = findExercise(ex.exerciseId);
		if (!info) return;
		ex.sets.forEach((s, si) => {
			const base = { id: `${log.id}:${ei}:${si}`, exerciseId: ex.exerciseId, completed: true, performedAt: noon(log.date) };
			if (info.timed) sets.push({ ...base, kind: "timed", reps: null, weightKg: null, durationSec: Math.round(s.reps) });
			else sets.push({ ...base, kind: s.weight !== undefined ? "weighted" : "bodyweight", reps: Math.round(s.reps), weightKg: s.weight ?? null, durationSec: null });
		});
	});
	return {
		id: log.id,
		trainingId: null,
		planDate: plan ? plan.date : null,
		performedOn: log.date,
		status: log.status,
		plannedSets: plan ? plan.exercises.reduce((n, b) => n + b.sets.length, 0) : 0,
		durationSec: Math.max(0, Math.round(log.durationSec)),
		perceived: log.perceived,
		adapted: log.adaptations.length > 0,
		adHoc: plan?.adHoc === true,
		sets,
	};
}

/** Explicit field copy: only analysis text leaves the device, never anything image-like. */
const insightOf = (i: Omit<PhotoInsight, "beforePhotoId" | "afterPhotoId"> & Partial<Pick<PhotoInsight, "beforePhotoId" | "afterPhotoId">>): PhotoInsight => ({
	id: i.id,
	analyzedAt: i.analyzedAt,
	beforeDate: i.beforeDate,
	afterDate: i.afterDate,
	beforePhotoId: i.beforePhotoId ?? null,
	afterPhotoId: i.afterPhotoId ?? null,
	beforeWeightKg: i.beforeWeightKg,
	afterWeightKg: i.afterWeightKg,
	model: i.model,
	engineVersion: i.engineVersion,
	suitable: i.suitable,
	result: { summary: i.result.summary, observations: i.result.observations.map((o) => ({ area: o.area, text: o.text })), encouragement: i.result.encouragement },
});

/** FitState -> raw facts for the backend. `today` only affects the synthetic initial goal check-in date. */
export function toRemote(full: FitState, today: IsoDate = toISO(new Date())): RemoteSnapshot {
	const state = syncableState(full);
	const h = historyFromFit(state, today);
	const refByDate = new Map<string, string>();
	for (const w of state.planned) if (!w.adHoc && !refByDate.has(w.date)) refByDate.set(w.date, w.id);
	const lastWeight = new Map<string, number>();
	for (const b of state.bodyWeights) lastWeight.set(b.date, b.kg);
	return {
		settings: { weeklyGoal: state.weeklyGoal, units: state.units, heightCm: state.profile?.heightCm ?? null },
		planDays: h.plan.map((p) => ({ date: p.date, type: p.type === "workout" ? "training" : "rest", workoutRef: refByDate.get(p.date) ?? null })),
		workouts: state.history.map((l) => workoutOf(state, l)),
		pauses: state.pauses.map((p) => ({ id: `pause:${p.from}`, fromDate: p.from, toDate: p.to })),
		weights: [...lastWeight].sort(([a], [b]) => a.localeCompare(b)).map(([d, kg]) => ({ date: d, kg })),
		events: state.progressEvents.map((e) => ({ id: e.id, kind: e.kind, refId: e.refId, createdAt: e.createdAt, seenAt: e.seenAt })),
		checkIns: h.checkIns.map((c) => ({
			id: c.id,
			kind: c.kind,
			date: c.date,
			takenAt: c.at.includes("T") ? c.at : `${c.at}T00:00:00.000Z`,
			weightKg: c.weightKg ?? null,
			goalKg: c.goalKg ?? null,
		})),
		photoInsights: state.photoInsights.map(insightOf),
	};
}

function logOf(w: RemoteWorkout): SessionLog | null {
	if (w.status === "abandoned") return null;
	const exercises: LoggedExercise[] = [];
	for (const s of w.sets) {
		let ex = exercises[exercises.length - 1];
		if (!ex || ex.exerciseId !== s.exerciseId) {
			ex = { exerciseId: s.exerciseId, skipped: false, sets: [] };
			exercises.push(ex);
		}
		if (s.kind === "timed") ex.sets.push({ reps: s.durationSec ?? 0 });
		else ex.sets.push(s.weightKg != null ? { reps: s.reps ?? 0, weight: s.weightKg } : { reps: s.reps ?? 0 });
	}
	const perceived = PERCEIVED.find((p) => p === w.perceived) ?? "right";
	const volumeKg = w.sets.reduce((n, s) => n + (s.kind === "weighted" ? (s.reps ?? 0) * (s.weightKg ?? 0) : 0), 0);
	return { id: w.id, plannedId: null, date: w.performedOn, title: "Workout", durationSec: w.durationSec, status: w.status, exercises, volumeKg, perceived, adaptations: w.adapted ? ["adapted"] : [], xp: 0, prs: [] };
}

/** Inverse of toRemote where it is meaningful; the reducer decides what actually gets applied. */
export function fromRemote(s: RemoteSnapshot): Partial<FitState> {
	const goal = [...s.checkIns].filter((c) => c.kind === "goal" && c.goalKg != null).sort((a, b) => a.takenAt.localeCompare(b.takenAt)).pop();
	const weightCheckIns = s.checkIns.filter((c) => c.kind === "weight");
	const bodyWeights = s.weights.map((w) => {
		const ci = weightCheckIns.filter((c) => c.date === w.date && c.weightKg === w.kg && !c.takenAt.endsWith("T00:00:00.000Z")).pop();
		return ci ? { date: w.date, kg: w.kg, at: ci.takenAt } : { date: w.date, kg: w.kg };
	});
	return {
		units: s.settings.units,
		weeklyGoal: s.settings.weeklyGoal,
		pauses: s.pauses.map((p) => ({ from: p.fromDate, to: p.toDate })),
		bodyWeights,
		...(goal ? { goalWeightKg: goal.goalKg ?? null, goalSetAt: goal.takenAt } : {}),
		progressEvents: s.events.map((e) => ({ id: e.id, kind: e.kind, refId: e.refId, createdAt: e.createdAt, seenAt: e.seenAt ?? null })),
		history: s.workouts.flatMap((w) => logOf(w) ?? []),
		photoInsights: (s.photoInsights ?? []).map(insightOf),
	};
}

export function snapshotOf(state: FitState, today: IsoDate): ProgressSnapshot {
	const real = syncableState(state);
	return progressSnapshot(historyFromFit(real, today), { weeklyGoal: real.weeklyGoal, pauses: real.pauses });
}

/**
 * Pure queue decision: which archive items to enqueue now.
 * A "change" item when the numbers differ from the last queued/sent hash; "weekly" items for finished weeks
 * that are neither archived nor already queued. Demo-only history is never archived.
 */
export function planArchive(state: FitState, snapshot: ProgressSnapshot, hash: string, today: IsoDate, opts: { now?: string; lastHash?: string | null } = {}): ArchiveItem[] {
	if (!state.history.some((l) => !l.demo)) return [];
	const now = opts.now ?? new Date().toISOString();
	const items: ArchiveItem[] = [];
	const queuedChange = [...state.archiveQueue].reverse().find((i) => i.period === "change");
	const last = opts.lastHash ?? queuedChange?.payloadHash ?? null;
	if (hash !== last) items.push({ id: `change:${hash}:${now}`, period: "change", weekStart: null, takenAt: now, engineVersion: ENGINE_VERSION, payload: snapshot, payloadHash: hash });

	const real = syncableState(state);
	const have = new Set([...state.archivedWeeks, ...state.archiveQueue.filter((i) => i.period === "weekly" && i.weekStart).map((i) => i.weekStart)]);
	const current = weekStart(today);
	const weeks = new Set<IsoDate>();
	for (const w of real.planned) if (!w.adHoc && weekStart(w.date) < current) weeks.add(weekStart(w.date));
	for (const monday of [...weeks].sort().slice(-8)) {
		if (have.has(monday)) continue;
		const end = addDays(monday, 6);
		const upTo: FitState = { ...real, history: real.history.filter((l) => l.date <= end), planned: real.planned.filter((w) => w.date <= end), bodyWeights: real.bodyWeights.filter((b) => b.date <= end), photos: real.photos.filter((p) => p.date <= end) };
		const payload = snapshotOf(upTo, end);
		items.push({ id: `weekly:${monday}`, period: "weekly", weekStart: monday, takenAt: now, engineVersion: ENGINE_VERSION, payload, payloadHash: snapshotHash(payload) });
	}
	return items;
}

const headers = (token: string) => ({ "x-progress-token": token });

/** GET the remote snapshot; null on any failure or invalid shape (state stays untouched). */
export async function fetchRemoteSnapshot(token: string): Promise<RemoteSnapshot | null> {
	try {
		const res = await fetch("/api/progress/snapshot", { headers: headers(token) });
		if (!res.ok) return null;
		const parsed = remoteSnapshotSchema.safeParse(await res.json());
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export async function postSync(token: string, body: RemoteSnapshot): Promise<boolean> {
	try {
		const res = await fetch("/api/progress/sync", { method: "POST", headers: { ...headers(token), "content-type": "application/json" }, body: JSON.stringify(body) });
		return res.ok;
	} catch {
		return false;
	}
}

export type ArchiveOutcome = "sent" | "drop" | "retry";

/** "sent": stored (201/200); "retry": timeout, rate limit, 5xx or anything unexpected; "drop": the server permanently rejects it (other 4xx). */
export function archiveOutcome(status: number): ArchiveOutcome {
	if (status === 200 || status === 201) return "sent";
	if (status >= 400 && status < 500 && status !== 408 && status !== 429) return "drop";
	return "retry";
}

/** Whether facts may be pushed: an empty device must first pull, or default settings would overwrite the remote ones. */
export function canPushSync(localHistoryLength: number, pulled: boolean): boolean {
	return localHistoryLength > 0 || pulled;
}

export async function postArchive(token: string, item: ArchiveItem): Promise<ArchiveOutcome> {
	try {
		const { id: _id, ...body } = item;
		const res = await fetch("/api/progress/archive", { method: "POST", headers: { ...headers(token), "content-type": "application/json" }, body: JSON.stringify(body) });
		return archiveOutcome(res.status);
	} catch {
		return "retry";
	}
}
