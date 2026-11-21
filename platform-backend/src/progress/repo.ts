import type { Knex } from "knex";
import type { Modifiers } from "objection";
import type { PhotoInsightResult } from "./models.js";
import {
  ProgressCheckInModel,
  ProgressEventModel,
  ProgressPauseModel,
  ProgressPhotoInsightModel,
  ProgressPlanDayModel,
  ProgressSettingsModel,
  ProgressSnapshotModel,
  ProgressWorkoutModel,
} from "./models.js";

export class HttpError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

export interface SetDto {
  id: string;
  exerciseId: string;
  kind: "weighted" | "bodyweight" | "timed";
  reps: number | null;
  weightKg: number | null;
  durationSec: number | null;
  completed: boolean;
  performedAt: string;
}
export interface WorkoutDto {
  id: string;
  trainingId: number | null;
  planDate: string | null;
  performedOn: string;
  status: "completed" | "partial" | "abandoned";
  plannedSets: number;
  durationSec: number;
  perceived: string | null;
  adapted: boolean;
  adHoc: boolean;
  sets: SetDto[];
}
export interface RemoteSnapshot {
  settings: { weeklyGoal: number; units: "metric" | "imperial"; heightCm: number | null };
  planDays: { date: string; type: "training" | "rest"; workoutRef: string | null }[];
  workouts: WorkoutDto[];
  pauses: { id: string; fromDate: string; toDate: string }[];
  weights: { date: string; kg: number }[];
  events: { id: string; kind: "badge" | "level" | "pr" | "report"; refId: string; payload: unknown; createdAt: string; seenAt: string | null }[];
  checkIns: { id: string; kind: "weight" | "goal" | "photo"; date: string; takenAt: string; weightKg: number | null; goalKg: number | null }[];
  photoInsights: PhotoInsightDto[];
}
export interface PhotoInsightDto {
  id: string;
  analyzedAt: string;
  beforeDate: string;
  afterDate: string;
  beforeWeightKg: number | null;
  afterWeightKg: number | null;
  model: string;
  engineVersion: string;
  suitable: boolean;
  result: PhotoInsightResult;
}
export type SyncBody = Partial<Omit<RemoteSnapshot, "settings">> & { settings?: Partial<RemoteSnapshot["settings"]> };
export interface ArchiveInput {
  period: "weekly" | "change";
  weekStart: string | null;
  takenAt: string;
  engineVersion: string;
  payload: object;
  payloadHash: string;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const guestEmail = (token: string): string => `guest-${token.toLowerCase()}@guest.invalid`;

async function findUserId(db: Knex, token: string): Promise<number | null> {
  const row = await ProgressSettingsModel.query(db).findOne({ clientToken: token });
  return row ? Number(row.userId) : null;
}

// Finds the guest user behind a progress token; with create=true makes one (users + settings, one transaction).
// users.id is internal: callers must never put it in a response.
export async function resolveUser(db: Knex, token: string, opts: { create: boolean }): Promise<number | null> {
  const existing = await findUserId(db, token);
  if (existing !== null || !opts.create) return existing;
  return db.transaction(async (trx) => {
    // Serialize first-time creation per token (held until commit): a concurrent claimant waits, then re-selects.
    await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [token]);
    const again = await findUserId(trx, token);
    if (again !== null) return again;
    const [user] = await trx("users").insert({ name: "Guest", email: guestEmail(token) }).returning("id");
    await trx("user_progress_settings").insert({ userId: user.id, clientToken: token });
    return Number(user.id);
  });
}

// Resolves (creating if needed) the guest and runs the write in ONE transaction: a write that fails
// (400/409/...) rolls back the freshly created guest too, so no orphan users are left behind.
export async function withGuestUser<T>(db: Knex, token: string, fn: (trx: Knex.Transaction, userId: number) => Promise<T>): Promise<T> {
  return db.transaction(async (trx) => {
    const userId = await resolveUser(trx, token, { create: true });
    return fn(trx, userId as number);
  });
}

function toWorkoutDto(w: ProgressWorkoutModel): WorkoutDto {
  return {
    id: w.id,
    trainingId: w.trainingId === null ? null : Number(w.trainingId),
    planDate: w.planDate,
    performedOn: w.performedOn,
    status: w.status,
    plannedSets: w.plannedSets,
    durationSec: w.durationSec,
    perceived: w.perceived,
    adapted: w.adapted,
    adHoc: w.adHoc,
    sets: (w.sets ?? []).map((s) => ({
      id: s.id,
      exerciseId: s.exerciseId,
      kind: s.kind,
      reps: s.reps,
      weightKg: s.weightKg,
      durationSec: s.durationSec,
      completed: s.completed,
      performedAt: s.performedAt.toISOString(),
    })),
  };
}

const orderedSets: Modifiers = { ordered: (b) => b.orderBy("performedAt").orderBy("id") };

export async function getSnapshot(db: Knex, userId: number | null): Promise<RemoteSnapshot> {
  const snapshot: RemoteSnapshot = { settings: { weeklyGoal: 3, units: "metric", heightCm: null }, planDays: [], workouts: [], pauses: [], weights: [], events: [], checkIns: [], photoInsights: [] };
  if (userId === null) return snapshot;
  const [settings, planDays, workouts, pauses, weights, events, checkIns, photoInsights] = await Promise.all([
    ProgressSettingsModel.query(db).findById(userId),
    ProgressPlanDayModel.query(db).where({ userId }).orderBy("date"),
    ProgressWorkoutModel.query(db).where({ userId }).withGraphFetched("sets(ordered)").modifiers(orderedSets).orderBy("performedOn").orderBy("id"),
    ProgressPauseModel.query(db).where({ userId }).orderBy("fromDate").orderBy("id"),
    db("user_progress_weights").where({ userId }).orderBy("date"),
    ProgressEventModel.query(db).where({ userId }).orderBy("createdAt").orderBy("id"),
    ProgressCheckInModel.query(db).where({ userId }).orderBy("takenAt").orderBy("id"),
    ProgressPhotoInsightModel.query(db).where({ userId }).orderBy("analyzedAt").orderBy("id"),
  ]);
  if (settings) snapshot.settings = { weeklyGoal: settings.weeklyGoal, units: settings.units, heightCm: null };
  snapshot.planDays = planDays.map((p) => ({ date: p.date, type: p.type, workoutRef: p.workoutRef }));
  snapshot.workouts = workouts.map(toWorkoutDto);
  snapshot.pauses = pauses.map((p) => ({ id: p.id, fromDate: p.fromDate, toDate: p.toDate }));
  snapshot.weights = weights.map((w: { date: string; kg: number }) => ({ date: w.date, kg: w.kg }));
  snapshot.events = events.map((e) => ({ id: e.id, kind: e.kind, refId: e.refId, payload: e.payload, createdAt: e.createdAt.toISOString(), seenAt: iso(e.seenAt) }));
  snapshot.checkIns = checkIns.map((c) => ({ id: c.id, kind: c.kind, date: c.date, takenAt: c.takenAt.toISOString(), weightKg: c.weightKg, goalKg: c.goalKg }));
  snapshot.photoInsights = photoInsights.map((p) => ({
    id: p.id, analyzedAt: p.analyzedAt.toISOString(), beforeDate: p.beforeDate, afterDate: p.afterDate, beforeWeightKg: p.beforeWeightKg, afterWeightKg: p.afterWeightKg,
    model: p.model, engineVersion: p.engineVersion, suitable: p.suitable, result: p.result,
  }));
  return snapshot;
}

// Rows (by primary key id) already owned by another user must never be taken over by an upsert.
async function assertNotForeign(trx: Knex.Transaction, table: string, userId: number, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const foreign = await trx(table).whereIn("id", ids).whereNot({ userId }).first("id");
  if (foreign) throw new HttpError(409, `${table} id belongs to another user`);
}

export async function syncSnapshot(db: Knex, userId: number, body: SyncBody) {
  const planDays = body.planDays ?? [];
  const workouts = body.workouts ?? [];
  const pauses = body.pauses ?? [];
  const weights = body.weights ?? [];
  const events = body.events ?? [];
  const checkIns = body.checkIns ?? [];
  const photoInsights = body.photoInsights ?? [];
  const sets = workouts.flatMap((w) => w.sets.map((s) => ({ ...s, workoutId: w.id })));

  await db.transaction(async (trx) => {
    const trainingIds = [...new Set(workouts.map((w) => w.trainingId).filter((id): id is number => id !== null && id !== undefined))];
    if (trainingIds.length > 0) {
      const own = await trx("user_trainings").where({ userId }).whereIn("id", trainingIds).select("id");
      if (own.length !== trainingIds.length) throw new HttpError(400, "trainingId does not belong to this user");
    }
    await assertNotForeign(trx, "user_progress_workouts", userId, workouts.map((w) => w.id));
    await assertNotForeign(trx, "user_progress_sets", userId, sets.map((s) => s.id));
    await assertNotForeign(trx, "user_progress_pauses", userId, pauses.map((p) => p.id));
    await assertNotForeign(trx, "user_progress_events", userId, events.map((e) => e.id));
    await assertNotForeign(trx, "user_progress_checkins", userId, checkIns.map((c) => c.id));
    await assertNotForeign(trx, "user_progress_photo_insights", userId, photoInsights.map((p) => p.id));

    if (body.settings && Object.keys(body.settings).length > 0) {
      const patch: Record<string, unknown> = { updatedAt: trx.fn.now() };
      if (body.settings.weeklyGoal !== undefined) patch.weeklyGoal = body.settings.weeklyGoal;
      if (body.settings.units !== undefined) patch.units = body.settings.units;
      await trx("user_progress_settings").where({ userId }).update(patch);
    }
    if (planDays.length) {
      await trx("user_progress_plan_days").insert(planDays.map((p) => ({ userId, date: p.date, type: p.type, workoutRef: p.workoutRef ?? null }))).onConflict(["userId", "date"]).merge();
    }
    if (workouts.length) {
      const rows = workouts.map((w) => ({
        id: w.id, userId, trainingId: w.trainingId ?? null, planDate: w.planDate ?? null, performedOn: w.performedOn, status: w.status,
        plannedSets: w.plannedSets, durationSec: w.durationSec, perceived: w.perceived ?? null, adapted: w.adapted, adHoc: w.adHoc,
      }));
      await trx("user_progress_workouts").insert(rows).onConflict("id").merge();
      await trx("user_progress_sets").where({ userId }).whereIn("workoutId", workouts.map((w) => w.id)).delete();
    }
    if (sets.length) {
      const rows = sets.map((s) => ({
        id: s.id, userId, workoutId: s.workoutId, exerciseId: s.exerciseId, kind: s.kind, reps: s.reps ?? null, weightKg: s.weightKg ?? null,
        durationSec: s.durationSec ?? null, completed: s.completed, performedAt: s.performedAt,
      }));
      await trx("user_progress_sets").insert(rows).onConflict("id").merge();
    }
    if (pauses.length) {
      await trx("user_progress_pauses").insert(pauses.map((p) => ({ id: p.id, userId, fromDate: p.fromDate, toDate: p.toDate }))).onConflict("id").merge();
    }
    if (weights.length) {
      await trx("user_progress_weights").insert(weights.map((w) => ({ userId, date: w.date, kg: w.kg }))).onConflict(["userId", "date"]).merge();
    }
    if (events.length) {
      // seen_at is only ever set, never cleared by a later sync that still has it null.
      await trx("user_progress_events")
        .insert(events.map((e) => ({ id: e.id, userId, kind: e.kind, refId: e.refId, payload: JSON.stringify(e.payload ?? null), createdAt: e.createdAt, seenAt: e.seenAt ?? null })))
        .onConflict("id")
        .merge({
          kind: trx.raw("excluded.kind"),
          refId: trx.raw("excluded.ref_id"),
          payload: trx.raw("excluded.payload"),
          createdAt: trx.raw("excluded.created_at"),
          seenAt: trx.raw("coalesce(excluded.seen_at, user_progress_events.seen_at)"),
        });
    }
    if (checkIns.length) {
      await trx("user_progress_checkins")
        .insert(checkIns.map((c) => ({ id: c.id, userId, kind: c.kind, date: c.date, takenAt: c.takenAt, weightKg: c.weightKg ?? null, goalKg: c.goalKg ?? null })))
        .onConflict("id")
        .merge();
    }
    if (photoInsights.length) {
      await trx("user_progress_photo_insights")
        .insert(photoInsights.map((p) => ({
          id: p.id, userId, analyzedAt: p.analyzedAt, beforeDate: p.beforeDate, afterDate: p.afterDate, beforeWeightKg: p.beforeWeightKg ?? null, afterWeightKg: p.afterWeightKg ?? null,
          model: p.model, engineVersion: p.engineVersion, suitable: p.suitable, result: JSON.stringify(p.result),
        })))
        .onConflict("id")
        .merge();
    }
  });
  return {
    ok: true as const,
    counts: { planDays: planDays.length, workouts: workouts.length, sets: sets.length, pauses: pauses.length, weights: weights.length, events: events.length, checkIns: checkIns.length, photoInsights: photoInsights.length },
  };
}

export async function markEventsSeen(db: Knex, userId: number | null, ids: string[], seenAt: string): Promise<number> {
  if (userId === null || ids.length === 0) return 0;
  // First seen wins: rows that already have seen_at are left alone and not counted.
  return ProgressEventModel.query(db).patch({ seenAt: new Date(seenAt) }).where({ userId }).whereNull("seenAt").whereIn("id", ids);
}

// Append-only archive: this module only inserts into / selects from user_progress_snapshots.
export async function archiveSnapshot(db: Knex, userId: number, input: ArchiveInput): Promise<boolean> {
  const row = { userId, period: input.period, weekStart: input.weekStart, takenAt: input.takenAt, engineVersion: input.engineVersion, payload: JSON.stringify(input.payload), payloadHash: input.payloadHash };
  if (input.period === "weekly") {
    const res = await db.raw(
      "insert into user_progress_snapshots (user_id, period, week_start, taken_at, engine_version, payload, payload_hash) values (?, ?, ?, ?, ?, ?::jsonb, ?) on conflict (user_id, week_start) where period = 'weekly' do nothing",
      [row.userId, row.period, row.weekStart, row.takenAt, row.engineVersion, row.payload, row.payloadHash],
    );
    return res.rowCount === 1;
  }
  // check-then-insert must be atomic per user: serialize concurrent change archives on an advisory lock.
  return db.transaction(async (trx) => {
    await trx.raw("select pg_advisory_xact_lock(?)", [userId]);
    const latest = await ProgressSnapshotModel.query(trx).where({ userId }).orderBy("takenAt", "desc").orderBy("id", "desc").first();
    if (latest && latest.payloadHash === input.payloadHash) return false;
    await trx("user_progress_snapshots").insert(row);
    return true;
  });
}

export async function listArchive(db: Knex, userId: number | null, q: { from?: string; to?: string; period?: "weekly" | "change" }) {
  if (userId === null) return [];
  const query = ProgressSnapshotModel.query(db).where({ userId }).orderBy("takenAt").orderBy("id");
  if (q.from) query.whereRaw("(taken_at at time zone 'UTC')::date >= ?", [q.from]);
  if (q.to) query.whereRaw("(taken_at at time zone 'UTC')::date <= ?", [q.to]);
  if (q.period) query.where({ period: q.period });
  const rows = await query;
  return rows.map((s) => ({ period: s.period, weekStart: s.weekStart, takenAt: s.takenAt.toISOString(), engineVersion: s.engineVersion, payload: s.payload }));
}

export interface WorkoutSummary {
  totalSets: number;
  completedSets: number;
  plannedSets: number;
  exercises: string[]; // distinct exercise ids in the order they were performed
  volumeKg: number; // sum of reps × weight over completed weighted sets
  durationSec: number;
}
export type HistoryWorkout = WorkoutDto & { summary: WorkoutSummary };
export interface HistoryQuery {
  from?: string;
  to?: string;
  status?: WorkoutDto["status"];
  limit?: number;
  cursor?: string;
}

function summarize(w: WorkoutDto): WorkoutSummary {
  const done = w.sets.filter((s) => s.completed);
  const volume = done.reduce((sum, s) => (s.kind === "weighted" && s.reps !== null && s.weightKg !== null ? sum + s.reps * s.weightKg : sum), 0);
  return {
    totalSets: w.sets.length,
    completedSets: done.length,
    plannedSets: w.plannedSets,
    exercises: [...new Set(w.sets.map((s) => s.exerciseId))],
    volumeKg: Math.round(volume * 100) / 100,
    durationSec: w.durationSec,
  };
}

// Opaque keyset cursor: base64url of [performedOn, id] of the last workout on the page.
const encodeCursor = (w: WorkoutDto): string => Buffer.from(JSON.stringify([w.performedOn, w.id])).toString("base64url");
function decodeCursor(cursor: string): [string, string] {
  try {
    const v: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v[0]) && typeof v[1] === "string") return [v[0], v[1]];
  } catch {
    // fall through
  }
  throw new HttpError(400, "invalid cursor");
}

// Training history: own workouts, newest first (performed_on desc, id desc), with sets and a per-workout summary.
export async function listWorkouts(db: Knex, userId: number | null, q: HistoryQuery): Promise<{ workouts: HistoryWorkout[]; nextCursor: string | null }> {
  const after = q.cursor ? decodeCursor(q.cursor) : null;
  if (userId === null) return { workouts: [], nextCursor: null };
  const limit = q.limit ?? 50;
  const query = ProgressWorkoutModel.query(db).where({ userId }).withGraphFetched("sets(ordered)").modifiers(orderedSets).orderBy("performedOn", "desc").orderBy("id", "desc").limit(limit + 1);
  if (q.from) query.where("performedOn", ">=", q.from);
  if (q.to) query.where("performedOn", "<=", q.to);
  if (q.status) query.where({ status: q.status });
  if (after) query.whereRaw("(performed_on, id) < (?::date, ?)", after);
  const rows = (await query).map(toWorkoutDto);
  const page = rows.slice(0, limit);
  return { workouts: page.map((w) => ({ ...w, summary: summarize(w) })), nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null };
}
