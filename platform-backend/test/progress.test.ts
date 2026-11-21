import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Knex } from "knex";
import { createDb, migrate, migrationConfig } from "../src/db.js";
import { ProgressSetModel, ProgressWeightModel, ProgressWorkoutModel } from "../src/progress/models.js";

const PROGRESS_TABLES = [
  "user_progress_checkins",
  "user_progress_events",
  "user_progress_pauses",
  "user_progress_photo_insights",
  "user_progress_plan_days",
  "user_progress_sets",
  "user_progress_settings",
  "user_progress_snapshots",
  "user_progress_weights",
  "user_progress_workouts",
];
const TEAM_TABLES = ["trainers", "user_device_data_snapshots", "user_devices", "user_trainings", "users"];
const TOKEN = "11111111-1111-4111-8111-111111111111";

describe("progress schema", () => {
  let container: StartedPostgreSqlContainer;
  let db: Knex;

  const tables = async (): Promise<string[]> => {
    const { rows } = await db.raw("select tablename from pg_tables where schemaname = 'public' and tablename not like 'knex_%' order by tablename");
    return rows.map((r: { tablename: string }) => r.tablename);
  };
  const columns = async (table: string): Promise<Record<string, { type: string; nullable: boolean }>> => {
    const { rows } = await db.raw("select column_name, data_type, is_nullable from information_schema.columns where table_name = ?", [table]);
    return Object.fromEntries(rows.map((r: { column_name: string; data_type: string; is_nullable: string }) => [r.column_name, { type: r.data_type, nullable: r.is_nullable === "YES" }]));
  };
  const indexes = async (table: string): Promise<string[]> => {
    const { rows } = await db.raw("select indexdef from pg_indexes where tablename = ?", [table]);
    return rows.map((r: { indexdef: string }) => r.indexdef);
  };
  const seedUser = async (email = "p@example.com"): Promise<string> => {
    const [u] = await db("users").insert({ name: "P", email }).returning("id");
    return u.id;
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    db = createDb(container.getConnectionUri());
  });
  afterAll(async () => {
    await db?.destroy();
    await container?.stop();
  });
  beforeEach(async () => {
    await db.migrate.rollback(migrationConfig, true);
    await migrate(db);
  });

  it("creates the 8 tables with the specified columns", async () => {
    expect((await tables()).filter((t) => t.startsWith("user_progress_"))).toEqual(PROGRESS_TABLES);
    const tz = "timestamp with time zone";
    expect(await columns("user_progress_settings")).toMatchObject({
      user_id: { type: "bigint", nullable: false },
      client_token: { type: "uuid", nullable: false },
      weekly_goal: { type: "smallint", nullable: false },
      units: { type: "text", nullable: false },
      created_at: { type: tz, nullable: false },
      updated_at: { type: tz, nullable: false },
    });
    expect(await columns("user_progress_plan_days")).toMatchObject({
      user_id: { type: "bigint", nullable: false },
      date: { type: "date", nullable: false },
      type: { type: "text", nullable: false },
      workout_ref: { type: "text", nullable: true },
    });
    expect(await columns("user_progress_workouts")).toMatchObject({
      id: { type: "text", nullable: false },
      user_id: { type: "bigint", nullable: false },
      training_id: { type: "bigint", nullable: true },
      plan_date: { type: "date", nullable: true },
      performed_on: { type: "date", nullable: false },
      status: { type: "text", nullable: false },
      planned_sets: { type: "smallint", nullable: false },
      duration_sec: { type: "integer", nullable: false },
      perceived: { type: "text", nullable: true },
      adapted: { type: "boolean", nullable: false },
      ad_hoc: { type: "boolean", nullable: false },
      created_at: { type: tz, nullable: false },
    });
    expect(await columns("user_progress_sets")).toMatchObject({
      id: { type: "text", nullable: false },
      user_id: { type: "bigint", nullable: false },
      workout_id: { type: "text", nullable: false },
      exercise_id: { type: "text", nullable: false },
      kind: { type: "text", nullable: false },
      reps: { type: "smallint", nullable: true },
      weight_kg: { type: "numeric", nullable: true },
      duration_sec: { type: "integer", nullable: true },
      completed: { type: "boolean", nullable: false },
      performed_at: { type: tz, nullable: false },
    });
    expect(await columns("user_progress_pauses")).toMatchObject({
      id: { type: "text", nullable: false },
      user_id: { type: "bigint", nullable: false },
      from_date: { type: "date", nullable: false },
      to_date: { type: "date", nullable: false },
    });
    expect(await columns("user_progress_weights")).toMatchObject({
      user_id: { type: "bigint", nullable: false },
      date: { type: "date", nullable: false },
      kg: { type: "numeric", nullable: false },
    });
    expect(await columns("user_progress_events")).toMatchObject({
      id: { type: "text", nullable: false },
      user_id: { type: "bigint", nullable: false },
      kind: { type: "text", nullable: false },
      ref_id: { type: "text", nullable: false },
      payload: { type: "jsonb", nullable: true },
      created_at: { type: tz, nullable: false },
      seen_at: { type: tz, nullable: true },
    });
    expect(await columns("user_progress_checkins")).toEqual({
      id: { type: "text", nullable: false },
      user_id: { type: "bigint", nullable: false },
      kind: { type: "text", nullable: false },
      date: { type: "date", nullable: false },
      taken_at: { type: tz, nullable: false },
      weight_kg: { type: "numeric", nullable: true },
      goal_kg: { type: "numeric", nullable: true },
      created_at: { type: tz, nullable: false },
    });
    expect(await columns("user_progress_photo_insights")).toEqual({
      id: { type: "text", nullable: false },
      user_id: { type: "bigint", nullable: false },
      analyzed_at: { type: tz, nullable: false },
      before_date: { type: "date", nullable: false },
      after_date: { type: "date", nullable: false },
      before_photo_id: { type: "text", nullable: true },
      after_photo_id: { type: "text", nullable: true },
      before_weight_kg: { type: "numeric", nullable: true },
      after_weight_kg: { type: "numeric", nullable: true },
      model: { type: "text", nullable: false },
      engine_version: { type: "text", nullable: false },
      suitable: { type: "boolean", nullable: false },
      result: { type: "jsonb", nullable: false },
      created_at: { type: tz, nullable: false },
    });
    expect(await columns("user_progress_snapshots")).toMatchObject({
      id: { type: "bigint", nullable: false },
      user_id: { type: "bigint", nullable: false },
      period: { type: "text", nullable: false },
      week_start: { type: "date", nullable: true },
      taken_at: { type: tz, nullable: false },
      engine_version: { type: "text", nullable: false },
      payload: { type: "jsonb", nullable: false },
      payload_hash: { type: "text", nullable: false },
    });
    const { rows } = await db.raw("select table_name, column_name, numeric_precision p, numeric_scale s from information_schema.columns where data_type = 'numeric' and table_name like 'user_progress_%' order by 1, 2");
    expect(rows).toEqual([
      { table_name: "user_progress_checkins", column_name: "goal_kg", p: 5, s: 2 },
      { table_name: "user_progress_checkins", column_name: "weight_kg", p: 5, s: 2 },
      { table_name: "user_progress_photo_insights", column_name: "after_weight_kg", p: 5, s: 2 },
      { table_name: "user_progress_photo_insights", column_name: "before_weight_kg", p: 5, s: 2 },
      { table_name: "user_progress_sets", column_name: "weight_kg", p: 6, s: 2 },
      { table_name: "user_progress_weights", column_name: "kg", p: 5, s: 2 },
    ]);
  });

  it("snapshots: partial unique weekly, index (user_id, taken_at), append-only comment", async () => {
    const idx = await indexes("user_progress_snapshots");
    expect(idx.some((d) => /UNIQUE INDEX .*\(user_id, week_start\) WHERE .*period.*weekly/.test(d))).toBe(true);
    expect(idx.some((d) => /USING btree \(user_id, taken_at\)/.test(d))).toBe(true);
    const { rows } = await db.raw("select obj_description('user_progress_snapshots'::regclass) c");
    expect(rows[0].c).toBe("Append-only progress snapshots; rows are never updated or deleted.");

    const userId = await seedUser();
    const row = { userId, period: "weekly", weekStart: "2026-11-16", engineVersion: "1", payload: { a: 1 }, payloadHash: "h" };
    await db("user_progress_snapshots").insert(row);
    await expect(db("user_progress_snapshots").insert(row)).rejects.toThrow(/duplicate key/);
    await db("user_progress_snapshots").insert({ ...row, period: "change" });
    await db("user_progress_snapshots").insert({ ...row, period: "change" });
    await expect(db("user_progress_snapshots").insert({ ...row, period: "change", payload: null })).rejects.toThrow(/payload/);
  });

  it("indexes on user-scoped tables", async () => {
    expect(await indexes("user_progress_workouts")).toEqual(expect.arrayContaining([expect.stringContaining("(user_id, performed_on)")]));
    expect(await indexes("user_progress_sets")).toEqual(expect.arrayContaining([expect.stringContaining("(user_id, exercise_id, performed_at)")]));
    expect(await indexes("user_progress_pauses")).toEqual(expect.arrayContaining([expect.stringContaining("(user_id)")]));
    expect(await indexes("user_progress_events")).toEqual(expect.arrayContaining([expect.stringContaining("UNIQUE"), expect.stringContaining("(user_id, kind, ref_id)")]));
  });

  it("check constraints reject bad values", async () => {
    const userId = await seedUser();
    const settings = { userId, clientToken: TOKEN, weeklyGoal: 3, units: "metric" };
    await expect(db("user_progress_settings").insert({ ...settings, weeklyGoal: 6 })).rejects.toThrow(/check/);
    await expect(db("user_progress_settings").insert({ ...settings, weeklyGoal: 1 })).rejects.toThrow(/check/);
    await expect(db("user_progress_settings").insert({ ...settings, units: "stone" })).rejects.toThrow(/check/);
    await db("user_progress_settings").insert(settings);
    const u2 = await seedUser("q@example.com");
    await expect(db("user_progress_settings").insert({ ...settings, userId: u2 })).rejects.toThrow(/client_token/);

    await db("user_progress_pauses").insert({ id: "p1", userId, fromDate: "2026-11-01", toDate: "2026-11-28" }); // 27 days
    await expect(db("user_progress_pauses").insert({ id: "p2", userId, fromDate: "2026-11-01", toDate: "2026-11-30" })).rejects.toThrow(/check/); // 29 days
    await expect(db("user_progress_pauses").insert({ id: "p3", userId, fromDate: "2026-11-05", toDate: "2026-11-01" })).rejects.toThrow(/check/);

    await expect(db("user_progress_plan_days").insert({ userId, date: "2026-11-21", type: "nap" })).rejects.toThrow(/check/);
    await expect(db("user_progress_events").insert({ id: "e", userId, kind: "xx", refId: "r", payload: {} })).rejects.toThrow(/check/);
    await expect(db("user_progress_snapshots").insert({ userId, period: "daily", engineVersion: "1", payload: {}, payloadHash: "h" })).rejects.toThrow(/check/);
  });

  it("user delete cascades all progress data; workout delete cascades sets; training delete nulls training_id", async () => {
    const userId = await seedUser();
    const [tr] = await db("user_trainings").insert({ userId, planData: JSON.stringify({}) }).returning("id");
    expect((await columns("user_progress_workouts")).training_id.nullable).toBe(true);
    const workout = { userId, trainingId: tr.id, performedOn: "2026-11-21", status: "completed", plannedSets: 3, durationSec: 100, adapted: false, adHoc: false };
    await db("user_progress_workouts").insert({ id: "w1", ...workout });
    await db("user_progress_workouts").insert({ id: "w2", ...workout, trainingId: null });
    const set = (id: string, workoutId: string) => ({ id, userId, workoutId, exerciseId: "squat", kind: "weighted", reps: 5, weightKg: 100, completed: true, performedAt: "2026-11-21T10:00:00Z" });
    await db("user_progress_sets").insert([set("s1", "w1"), set("s2", "w2")]);

    await db("user_trainings").where({ id: tr.id }).delete();
    expect((await db("user_progress_workouts").where({ id: "w1" }).first()).trainingId).toBeNull();

    await db("user_progress_workouts").where({ id: "w2" }).delete();
    expect((await db("user_progress_sets").select("id")).map((r) => r.id)).toEqual(["s1"]);

    await db("user_progress_settings").insert({ userId, clientToken: TOKEN, weeklyGoal: 3, units: "metric" });
    await db("user_progress_plan_days").insert({ userId, date: "2026-11-21", type: "training" });
    await db("user_progress_pauses").insert({ id: "p", userId, fromDate: "2026-11-01", toDate: "2026-11-07" });
    await db("user_progress_weights").insert({ userId, date: "2026-11-21", kg: 80.5 });
    await db("user_progress_events").insert({ id: "e", userId, kind: "badge", refId: "b", payload: {} });
    await db("user_progress_snapshots").insert({ userId, period: "change", engineVersion: "1", payload: {}, payloadHash: "h" });
    await db("user_progress_checkins").insert({ id: "c", userId, kind: "weight", date: "2026-11-21", takenAt: "2026-11-21T08:00:00Z", weightKg: 80.5 });
    await db("users").where({ id: userId }).delete();
    for (const t of PROGRESS_TABLES) expect(await db(t).count("* as n")).toEqual([{ n: "0" }]);
  });

  it("models map camelCase, return numerics as numbers and load sets", async () => {
    const userId = await seedUser();
    await db("user_progress_workouts").insert({ id: "w1", userId, performedOn: "2026-11-21", status: "partial", plannedSets: 3, durationSec: 100, adapted: false, adHoc: true });
    await db("user_progress_sets").insert({ id: "s1", userId, workoutId: "w1", exerciseId: "squat", kind: "weighted", reps: 5, weightKg: 102.5, completed: true, performedAt: "2026-11-21T10:00:00Z" });
    await db("user_progress_weights").insert({ userId, date: "2026-11-21", kg: 80.25 });
    const w = await ProgressWorkoutModel.query(db).findById("w1").withGraphFetched("sets");
    expect(w).toMatchObject({ id: "w1", adHoc: true, plannedSets: 3 });
    expect(w!.sets[0]).toBeInstanceOf(ProgressSetModel);
    expect(w!.sets[0].weightKg).toBe(102.5);
    const kg = await ProgressWeightModel.query(db).first();
    expect(kg!.kg).toBe(80.25);
  });

  it("rolling back the last batch removes the 9 tables and keeps the team's", async () => {
    await db.migrate.rollback(migrationConfig, true);
    // Team migrations (7 files) as batch 1, progress as batch 2.
    const teamCount = 7;
    for (let i = 0; i < teamCount; i++) await db.migrate.up(migrationConfig);
    expect(await tables()).toEqual(TEAM_TABLES);
    await db.migrate.latest(migrationConfig);
    expect((await tables()).filter((t) => t.startsWith("user_progress_"))).toEqual(PROGRESS_TABLES);
    await db.migrate.rollback(migrationConfig);
    expect(await tables()).toEqual(TEAM_TABLES);
  });
});
