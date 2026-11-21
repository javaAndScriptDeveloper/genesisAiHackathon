import type { Knex } from "knex";
import {
  ProgressEventModel,
  ProgressPauseModel,
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
  const rollback = new Error("token claimed concurrently");
  try {
    return await db.transaction(async (trx) => {
      const [user] = await trx("users").insert({ name: "Guest", email: guestEmail(token) }).returning("id");
      const inserted = await trx("user_progress_settings").insert({ userId: user.id, clientToken: token }).onConflict("clientToken").ignore().returning("userId");
      if (inserted.length === 0) throw rollback; // a concurrent first sync won: drop our user, re-select theirs
      return Number(user.id);
    });
  } catch (err) {
    if (err !== rollback) throw err;
    const winner = await findUserId(db, token);
    if (winner === null) throw err;
    return winner;
  }
}

export async function getSnapshot(db: Knex, userId: number | null): Promise<RemoteSnapshot> {
  const snapshot: RemoteSnapshot = { settings: { weeklyGoal: 3, units: "metric", heightCm: null }, planDays: [], workouts: [], pauses: [], weights: [], events: [] };
  if (userId === null) return snapshot;
  const [settings, planDays, workouts, pauses, weights, events] = await Promise.all([
    ProgressSettingsModel.query(db).findById(userId),
    ProgressPlanDayModel.query(db).where({ userId }).orderBy("date"),
    ProgressWorkoutModel.query(db).where({ userId }).withGraphFetched("sets(ordered)").modifiers({ ordered: (b) => b.orderBy("performedAt").orderBy("id") }).orderBy("performedOn").orderBy("id"),
    ProgressPauseModel.query(db).where({ userId }).orderBy("fromDate").orderBy("id"),
    db("user_progress_weights").where({ userId }).orderBy("date"),
    ProgressEventModel.query(db).where({ userId }).orderBy("createdAt").orderBy("id"),
  ]);
  if (settings) snapshot.settings = { weeklyGoal: settings.weeklyGoal, units: settings.units, heightCm: null };
  snapshot.planDays = planDays.map((p) => ({ date: p.date, type: p.type, workoutRef: p.workoutRef }));
  snapshot.workouts = workouts.map((w) => ({
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
  }));
  snapshot.pauses = pauses.map((p) => ({ id: p.id, fromDate: p.fromDate, toDate: p.toDate }));
  snapshot.weights = weights.map((w: { date: string; kg: number }) => ({ date: w.date, kg: w.kg }));
  snapshot.events = events.map((e) => ({ id: e.id, kind: e.kind, refId: e.refId, payload: e.payload, createdAt: e.createdAt.toISOString(), seenAt: iso(e.seenAt) }));
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
  });
  return { ok: true as const, counts: { planDays: planDays.length, workouts: workouts.length, sets: sets.length, pauses: pauses.length, weights: weights.length, events: events.length } };
}

export async function markEventsSeen(db: Knex, userId: number | null, ids: string[], seenAt: string): Promise<number> {
  if (userId === null || ids.length === 0) return 0;
  return ProgressEventModel.query(db).patch({ seenAt: new Date(seenAt) }).where({ userId }).whereIn("id", ids);
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
  const latest = await ProgressSnapshotModel.query(db).where({ userId }).orderBy("takenAt", "desc").orderBy("id", "desc").first();
  if (latest && latest.payloadHash === input.payloadHash) return false;
  await db("user_progress_snapshots").insert(row);
  return true;
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
