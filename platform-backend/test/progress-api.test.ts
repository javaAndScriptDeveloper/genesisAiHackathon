import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Knex } from "knex";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { createDb, migrate, migrationConfig } from "../src/db.js";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const body = () => ({
  settings: { weeklyGoal: 4, units: "imperial", heightCm: 180 },
  planDays: [{ date: "2026-11-23", type: "training", workoutRef: "w1" }, { date: "2026-11-24", type: "rest", workoutRef: null }],
  workouts: [{
    id: "w1", trainingId: null, planDate: "2026-11-23", performedOn: "2026-11-23", status: "completed", plannedSets: 2,
    durationSec: 1800, perceived: "ok", adapted: false, adHoc: false,
    sets: [
      { id: "s1", exerciseId: "squat", kind: "weighted", reps: 5, weightKg: 100.5, durationSec: null, completed: true, performedAt: "2026-11-23T10:00:00.000Z" },
      { id: "s2", exerciseId: "plank", kind: "timed", reps: null, weightKg: null, durationSec: 60, completed: true, performedAt: "2026-11-23T10:05:00.000Z" },
    ],
  }],
  pauses: [{ id: "p1", fromDate: "2026-11-01", toDate: "2026-11-07" }],
  weights: [{ date: "2026-11-23", kg: 80.5 }],
  events: [{ id: "e1", kind: "badge", refId: "first", payload: { x: 1 }, createdAt: "2026-11-23T11:00:00.000Z", seenAt: null }],
});

describe("progress API", () => {
  let container: StartedPostgreSqlContainer;
  let db: Knex;
  let app: FastifyInstance;

  const call = (method: "GET" | "POST", url: string, token: string | undefined, payload?: unknown) =>
    app.inject({ method, url, headers: token ? { "x-progress-token": token } : {}, payload: payload as object });
  const count = async (t: string): Promise<number> => Number((await db(t).count("* as n"))[0].n);

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    db = createDb(container.getConnectionUri());
    app = buildApp(db);
  });
  afterAll(async () => {
    await app?.close();
    await db?.destroy();
    await container?.stop();
  });
  beforeEach(async () => {
    await db.migrate.rollback(migrationConfig, true);
    await migrate(db);
  });

  it("rejects missing or non-UUID token with 400", async () => {
    for (const token of [undefined, "nope"]) {
      const res = await call("GET", "/api/progress/snapshot", token);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "invalid progress token" });
    }
  });

  it("snapshot for unknown token is empty and creates no user", async () => {
    const res = await call("GET", "/api/progress/snapshot", A);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ settings: { weeklyGoal: 3, units: "metric", heightCm: null }, planDays: [], workouts: [], pauses: [], weights: [], events: [] });
    expect(await count("users")).toBe(0);
  });

  it("sync creates exactly one guest user, is idempotent and round-trips via snapshot", async () => {
    const r1 = await call("POST", "/api/progress/sync", A, body());
    expect(r1.statusCode).toBe(200);
    expect(r1.json()).toEqual({ ok: true, counts: { planDays: 2, workouts: 1, sets: 2, pauses: 1, weights: 1, events: 1 } });
    expect(await count("users")).toBe(1);
    const guest = await db("users").first();
    expect(guest).toMatchObject({ name: "Guest", email: `guest-${A}@guest.invalid` });
    const before = await Promise.all(["user_progress_plan_days", "user_progress_workouts", "user_progress_sets", "user_progress_pauses", "user_progress_weights", "user_progress_events"].map(count));

    const r2 = await call("POST", "/api/progress/sync", A, body());
    expect(r2.statusCode).toBe(200);
    expect(await count("users")).toBe(1);
    expect(await Promise.all(["user_progress_plan_days", "user_progress_workouts", "user_progress_sets", "user_progress_pauses", "user_progress_weights", "user_progress_events"].map(count))).toEqual(before);

    const snap = (await call("GET", "/api/progress/snapshot", A)).json();
    expect(JSON.stringify(snap)).not.toContain('"userId"');
    expect(snap.settings).toEqual({ weeklyGoal: 4, units: "imperial", heightCm: null });
    expect(snap.planDays).toEqual(body().planDays);
    expect(snap.pauses).toEqual(body().pauses);
    expect(snap.weights).toEqual(body().weights);
    expect(snap.events).toEqual(body().events);
    expect(snap.workouts).toHaveLength(1);
    expect(snap.workouts[0]).toMatchObject({ id: "w1", planDate: "2026-11-23", performedOn: "2026-11-23", status: "completed", perceived: "ok", trainingId: null });
    expect(snap.workouts[0].sets).toEqual(body().workouts[0].sets);
  });

  it("partial bodies are allowed and sets are replaced fully", async () => {
    expect((await call("POST", "/api/progress/sync", A, {})).statusCode).toBe(200);
    await call("POST", "/api/progress/sync", A, body());
    const b = body();
    b.workouts[0].sets = [b.workouts[0].sets[0]];
    const res = await call("POST", "/api/progress/sync", A, { workouts: b.workouts });
    expect(res.json().counts.sets).toBe(1);
    expect(await count("user_progress_sets")).toBe(1);
  });

  it("sync without header 400, bad kind 400, extra property 400", async () => {
    expect((await call("POST", "/api/progress/sync", undefined, body())).statusCode).toBe(400);
    const bad = body();
    bad.workouts[0].sets[0].kind = "weird";
    expect((await call("POST", "/api/progress/sync", A, bad)).statusCode).toBe(400);
    expect((await call("POST", "/api/progress/sync", A, { ...body(), extra: 1 })).statusCode).toBe(400);
    expect(await count("users")).toBe(0);
  });

  it("trainingId must belong to the same user", async () => {
    await call("POST", "/api/progress/sync", A, body());
    const other = (await call("POST", "/api/progress/sync", B, body()), await db("users").where({ email: `guest-${B}@guest.invalid` }).first());
    const [tr] = await db("user_trainings").insert({ userId: other.id, planData: JSON.stringify({}) }).returning("id");
    const b = body();
    (b.workouts[0] as { trainingId: number | null }).trainingId = Number(tr.id);
    expect((await call("POST", "/api/progress/sync", A, b)).statusCode).toBe(400);
    const own = await db("users").where({ email: `guest-${A}@guest.invalid` }).first();
    const [tr2] = await db("user_trainings").insert({ userId: own.id, planData: JSON.stringify({}) }).returning("id");
    (b.workouts[0] as { trainingId: number | null }).trainingId = Number(tr2.id);
    expect((await call("POST", "/api/progress/sync", A, b)).statusCode).toBe(200);
  });

  it("two tokens never see each other's data; a workout id owned by another user is rejected", async () => {
    await call("POST", "/api/progress/sync", A, body());
    const empty = (await call("GET", "/api/progress/snapshot", B)).json();
    expect(empty.workouts).toEqual([]);
    const other = body();
    other.weights = [{ date: "2026-11-23", kg: 70 }];
    expect((await call("POST", "/api/progress/sync", B, other)).statusCode).toBe(409);
    expect((await call("GET", "/api/progress/snapshot", A)).json().weights[0].kg).toBe(80.5);
  });

  it("events/seen marks only own events; unknown token updates 0 without creating a user", async () => {
    await call("POST", "/api/progress/sync", A, body());
    const bb = { events: [{ ...body().events[0], id: "e2" }] };
    expect((await call("POST", "/api/progress/sync", B, bb)).statusCode).toBe(200);
    const seenAt = "2026-11-24T08:00:00.000Z";
    const res = await call("POST", "/api/progress/events/seen", A, { ids: ["e1", "e2"], seenAt });
    expect(res.json()).toEqual({ updated: 1 });
    const snapA = (await call("GET", "/api/progress/snapshot", A)).json();
    expect(snapA.events[0].seenAt).toBe(seenAt);
    expect((await call("GET", "/api/progress/snapshot", B)).json().events[0].seenAt).toBeNull();
    // re-sync with seenAt null must not clear it
    await call("POST", "/api/progress/sync", A, body());
    expect((await call("GET", "/api/progress/snapshot", A)).json().events[0].seenAt).toBe(seenAt);
    const users = await count("users");
    const unknown = await call("POST", "/api/progress/events/seen", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", { ids: ["e1"], seenAt });
    expect(unknown.json()).toEqual({ updated: 0 });
    expect(await count("users")).toBe(users);
  });

  describe("archive", () => {
    const item = (over: Record<string, unknown> = {}) => ({
      period: "weekly", weekStart: "2026-11-16", takenAt: "2026-11-22T20:00:00.000Z", engineVersion: "2", payload: { n: 1 }, payloadHash: "h1", ...over,
    });

    it("weekly twice for the same week keeps one row and the first payload", async () => {
      const r1 = await call("POST", "/api/progress/archive", A, item());
      expect(r1.statusCode).toBe(201);
      expect(r1.json()).toEqual({ archived: true });
      const r2 = await call("POST", "/api/progress/archive", A, item({ payload: { n: 2 }, payloadHash: "h2" }));
      expect(r2.statusCode).toBe(200);
      expect(r2.json()).toEqual({ archived: false });
      const rows = await db("user_progress_snapshots");
      expect(rows).toHaveLength(1);
      expect(rows[0].payload).toEqual({ n: 1 });
      expect(await count("users")).toBe(1);
    });

    it("weekly validation: weekStart required and must be a Monday; change needs null", async () => {
      expect((await call("POST", "/api/progress/archive", A, item({ weekStart: null }))).statusCode).toBe(400);
      expect((await call("POST", "/api/progress/archive", A, item({ weekStart: "2026-11-17" }))).statusCode).toBe(400);
      expect((await call("POST", "/api/progress/archive", A, item({ period: "change" }))).statusCode).toBe(400);
      expect((await call("POST", "/api/progress/archive", A, item({ period: "daily" }))).statusCode).toBe(400);
    });

    it("change is skipped when hash equals the latest snapshot's, written otherwise", async () => {
      const c = (hash: string, takenAt: string) => item({ period: "change", weekStart: null, payloadHash: hash, takenAt });
      expect((await call("POST", "/api/progress/archive", A, c("x", "2026-11-20T10:00:00.000Z"))).statusCode).toBe(201);
      const dup = await call("POST", "/api/progress/archive", A, c("x", "2026-11-21T10:00:00.000Z"));
      expect(dup.statusCode).toBe(200);
      expect(dup.json()).toEqual({ archived: false });
      expect((await call("POST", "/api/progress/archive", A, c("y", "2026-11-21T10:00:00.000Z"))).statusCode).toBe(201);
      expect(await count("user_progress_snapshots")).toBe(2);
      // another user's identical hash is independent
      expect((await call("POST", "/api/progress/archive", B, c("y", "2026-11-21T10:00:00.000Z"))).statusCode).toBe(201);
    });

    it("GET archive returns only own snapshots within dates, ascending, filtered by period", async () => {
      await call("POST", "/api/progress/archive", A, item({ takenAt: "2026-11-22T20:00:00.000Z" }));
      await call("POST", "/api/progress/archive", A, item({ period: "change", weekStart: null, payloadHash: "c1", takenAt: "2026-11-10T09:00:00.000Z" }));
      await call("POST", "/api/progress/archive", A, item({ weekStart: "2026-11-23", payloadHash: "h3", takenAt: "2026-12-01T09:00:00.000Z" }));
      await call("POST", "/api/progress/archive", B, item());
      const all = (await call("GET", "/api/progress/archive?from=2026-11-01&to=2026-11-30", A)).json().snapshots;
      expect(all.map((s: { takenAt: string }) => s.takenAt)).toEqual(["2026-11-10T09:00:00.000Z", "2026-11-22T20:00:00.000Z"]);
      expect(all[1]).toEqual({ period: "weekly", weekStart: "2026-11-16", takenAt: "2026-11-22T20:00:00.000Z", engineVersion: "2", payload: { n: 1 } });
      const weekly = (await call("GET", "/api/progress/archive?period=weekly", A)).json().snapshots;
      expect(weekly).toHaveLength(2);
      expect((await call("GET", "/api/progress/archive?from=2026-11-22&to=2026-11-22", A)).json().snapshots).toHaveLength(1);
      expect((await call("GET", "/api/progress/archive", "cccccccc-cccc-4ccc-8ccc-cccccccccccc")).json()).toEqual({ snapshots: [] });
      expect((await call("GET", "/api/progress/archive?from=bad", A)).statusCode).toBe(400);
    });

    it("repository code never updates or deletes user_progress_snapshots", () => {
      const src = readFileSync(new URL("../src/progress/repo.ts", import.meta.url), "utf8");
      expect(src).not.toMatch(/ProgressSnapshotModel[\s\S]{0,80}\.(patch|update|delete|truncate)\b/);
      expect(src).not.toMatch(/user_progress_snapshots[^\n]*\.(update|del|delete|truncate)\b/);
      expect(src).not.toMatch(/(update|delete from)\s+user_progress_snapshots/i);
    });
  });
});
