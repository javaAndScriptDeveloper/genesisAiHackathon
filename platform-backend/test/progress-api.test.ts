import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Knex } from "knex";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { createDb, migrate, migrationConfig } from "../src/db.js";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const insight = (id: string, analyzedAt: string) => ({
  id, analyzedAt, beforeDate: "2026-10-01", afterDate: "2026-11-20", beforePhotoId: "ph1", afterPhotoId: null, beforeWeightKg: 85.5, afterWeightKg: null, model: "gemini-test", engineVersion: "photo-v1", suitable: true,
  result: { summary: "Looks steadier.", observations: [{ area: "posture", text: "Shoulders are more level." }], encouragement: "Keep going." },
});

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
  checkIns: [
    { id: "c3", kind: "photo", date: "2026-11-23", takenAt: "2026-11-23T09:30:00.000Z", weightKg: 80.5, goalKg: null },
    { id: "c1", kind: "weight", date: "2026-11-21", takenAt: "2026-11-21T08:00:00.000Z", weightKg: 81.25, goalKg: null },
    { id: "c2", kind: "goal", date: "2026-11-22", takenAt: "2026-11-22T08:00:00.000Z", weightKg: null, goalKg: 75 },
  ],
  photoInsights: [
    insight("i2", "2026-11-24T10:00:00.000Z"),
    insight("i1", "2026-11-23T10:00:00.000Z"),
  ],
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
    expect(res.json()).toEqual({ settings: { weeklyGoal: 3, units: "metric", heightCm: null }, planDays: [], workouts: [], pauses: [], weights: [], events: [], checkIns: [], photoInsights: [] });
    expect(await count("users")).toBe(0);
  });

  it("sync creates exactly one guest user, is idempotent and round-trips via snapshot", async () => {
    const r1 = await call("POST", "/api/progress/sync", A, body());
    expect(r1.statusCode).toBe(200);
    expect(r1.json()).toEqual({ ok: true, counts: { planDays: 2, workouts: 1, sets: 2, pauses: 1, weights: 1, events: 1, checkIns: 3, photoInsights: 2 } });
    expect(await count("users")).toBe(1);
    const guest = await db("users").first();
    expect(guest).toMatchObject({ name: "Guest", email: `guest-${A}@guest.invalid` });
    const before = await Promise.all(["user_progress_plan_days", "user_progress_workouts", "user_progress_sets", "user_progress_pauses", "user_progress_weights", "user_progress_events", "user_progress_checkins", "user_progress_photo_insights"].map(count));

    const r2 = await call("POST", "/api/progress/sync", A, body());
    expect(r2.statusCode).toBe(200);
    expect(await count("users")).toBe(1);
    expect(await Promise.all(["user_progress_plan_days", "user_progress_workouts", "user_progress_sets", "user_progress_pauses", "user_progress_weights", "user_progress_events", "user_progress_checkins", "user_progress_photo_insights"].map(count))).toEqual(before);

    const snap = (await call("GET", "/api/progress/snapshot", A)).json();
    expect(JSON.stringify(snap)).not.toContain('"userId"');
    expect(snap.settings).toEqual({ weeklyGoal: 4, units: "imperial", heightCm: null });
    expect(snap.planDays).toEqual(body().planDays);
    expect(snap.pauses).toEqual(body().pauses);
    expect(snap.weights).toEqual(body().weights);
    expect(snap.events).toEqual(body().events);
    expect(snap.checkIns).toEqual([...body().checkIns].sort((a, b) => a.takenAt.localeCompare(b.takenAt)));
    expect(snap.checkIns.map((c: { id: string }) => c.id)).toEqual(["c1", "c2", "c3"]);
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
    await call("POST", "/api/progress/sync", B, { weights: [{ date: "2026-11-23", kg: 70 }] });
    const other = await db("users").where({ email: `guest-${B}@guest.invalid` }).first();
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

  describe("check-ins", () => {
    it("sync stores check-ins once and snapshot returns them ordered by takenAt", async () => {
      await call("POST", "/api/progress/sync", A, { checkIns: body().checkIns });
      await call("POST", "/api/progress/sync", A, { checkIns: body().checkIns });
      expect(await count("user_progress_checkins")).toBe(3);
      const snap = (await call("GET", "/api/progress/snapshot", A)).json();
      expect(snap.checkIns.map((c: { id: string }) => c.id)).toEqual(["c1", "c2", "c3"]);
      expect(snap.checkIns[0]).toEqual({ id: "c1", kind: "weight", date: "2026-11-21", takenAt: "2026-11-21T08:00:00.000Z", weightKg: 81.25, goalKg: null });
    });

    it("upsert updates an existing check-in by id", async () => {
      await call("POST", "/api/progress/sync", A, { checkIns: body().checkIns });
      const changed = { ...body().checkIns[1], weightKg: 80 };
      await call("POST", "/api/progress/sync", A, { checkIns: [changed] });
      expect(await count("user_progress_checkins")).toBe(3);
      expect((await call("GET", "/api/progress/snapshot", A)).json().checkIns[0].weightKg).toBe(80);
    });

    it("rejects an unknown kind and extra fields such as dataUrl with 400", async () => {
      const c = body().checkIns[0];
      expect((await call("POST", "/api/progress/sync", A, { checkIns: [{ ...c, kind: "selfie" }] })).statusCode).toBe(400);
      expect((await call("POST", "/api/progress/sync", A, { checkIns: [{ ...c, dataUrl: "data:image/png;base64,AAAA" }] })).statusCode).toBe(400);
      expect(await count("user_progress_checkins")).toBe(0);
    });

    it("a check-in id owned by another user is 409 and leaves the data untouched; snapshots are per user", async () => {
      await call("POST", "/api/progress/sync", A, { checkIns: body().checkIns });
      const res = await call("POST", "/api/progress/sync", B, { checkIns: [{ ...body().checkIns[0], weightKg: 1 }] });
      expect(res.statusCode).toBe(409);
      expect((await call("GET", "/api/progress/snapshot", B)).json().checkIns).toEqual([]);
      expect((await call("GET", "/api/progress/snapshot", A)).json().checkIns[2].weightKg).toBe(80.5);
    });

    it("deleting the user cascades to check-ins", async () => {
      await call("POST", "/api/progress/sync", A, { checkIns: body().checkIns });
      await db("users").delete();
      expect(await count("user_progress_checkins")).toBe(0);
    });
  });

  describe("photo insights", () => {
    it("round-trips ordered by analyzedAt and re-sync is idempotent", async () => {
      await call("POST", "/api/progress/sync", A, { photoInsights: body().photoInsights });
      await call("POST", "/api/progress/sync", A, { photoInsights: body().photoInsights });
      expect(await count("user_progress_photo_insights")).toBe(2);
      const snap = (await call("GET", "/api/progress/snapshot", A)).json();
      expect(snap.photoInsights.map((p: { id: string }) => p.id)).toEqual(["i1", "i2"]);
      expect(snap.photoInsights[0]).toEqual(insight("i1", "2026-11-23T10:00:00.000Z"));
      expect(JSON.stringify(snap)).not.toContain("data:");
    });

    it("rejects unknown fields such as dataUrl with 400 and stores nothing", async () => {
      const p = body().photoInsights[0];
      expect((await call("POST", "/api/progress/sync", A, { photoInsights: [{ ...p, beforePhotoId: "x".repeat(101) }] })).statusCode).toBe(400);
      expect((await call("POST", "/api/progress/sync", A, { photoInsights: [{ ...p, dataUrl: "data:image/png;base64,AAAA" }] })).statusCode).toBe(400);
      expect((await call("POST", "/api/progress/sync", A, { photoInsights: [{ ...p, result: { ...p.result, dataUrl: "x" } }] })).statusCode).toBe(400);
      expect((await call("POST", "/api/progress/sync", A, { photoInsights: [{ ...p, result: { ...p.result, observations: Array(5).fill({ area: "a", text: "t" }) } }] })).statusCode).toBe(400);
      expect(await count("user_progress_photo_insights")).toBe(0);
    });

    it("a foreign id is 409 and does not take the row over", async () => {
      await call("POST", "/api/progress/sync", A, { photoInsights: body().photoInsights });
      const res = await call("POST", "/api/progress/sync", B, { photoInsights: [{ ...body().photoInsights[0], model: "hijack" }] });
      expect(res.statusCode).toBe(409);
      expect((await call("GET", "/api/progress/snapshot", B)).json().photoInsights).toEqual([]);
      expect((await call("GET", "/api/progress/snapshot", A)).json().photoInsights[1].model).toBe("gemini-test");
    });

    it("deleting the user cascades to photo insights", async () => {
      await call("POST", "/api/progress/sync", A, { photoInsights: body().photoInsights });
      await db("users").delete();
      expect(await count("user_progress_photo_insights")).toBe(0);
    });
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

  it("events/seen: first seen wins and updated counts only newly seen rows", async () => {
    await call("POST", "/api/progress/sync", A, body());
    const first = "2026-11-24T08:00:00.000Z";
    expect((await call("POST", "/api/progress/events/seen", A, { ids: ["e1"], seenAt: first })).json()).toEqual({ updated: 1 });
    const again = await call("POST", "/api/progress/events/seen", A, { ids: ["e1"], seenAt: "2026-11-25T08:00:00.000Z" });
    expect(again.json()).toEqual({ updated: 0 });
    expect((await call("GET", "/api/progress/snapshot", A)).json().events[0].seenAt).toBe(first);
  });

  it("a rejected first sync leaves no orphan guest user", async () => {
    await call("POST", "/api/progress/sync", A, body());
    const users = await count("users");
    expect((await call("POST", "/api/progress/sync", B, body())).statusCode).toBe(409); // ids owned by A
    expect(await count("users")).toBe(users);
    expect(await count("user_progress_settings")).toBe(users);
    expect(await count("users")).toBe(users);
  });

  describe("workout history", () => {
    const set = (id: string, over: Record<string, unknown> = {}) => ({
      id, exerciseId: "squat", kind: "weighted", reps: 5, weightKg: 100, durationSec: null, completed: true, performedAt: "2026-11-02T10:00:00.000Z", ...over,
    });
    const workout = (id: string, performedOn: string, over: Record<string, unknown> = {}) => ({
      id, trainingId: null, planDate: performedOn, performedOn, status: "completed", plannedSets: 3, durationSec: 1500, perceived: null,
      adapted: false, adHoc: false, sets: [] as unknown[], ...over,
    });
    const history = (token: string, qs = "") => call("GET", `/api/progress/workouts${qs}`, token);

    it("unknown token gets an empty page and no user is created", async () => {
      const res = await history(A);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ workouts: [], nextCursor: null });
      expect(await count("users")).toBe(0);
    });

    it("returns own workouts newest first with sets and a summary", async () => {
      await call("POST", "/api/progress/sync", A, {
        workouts: [
          workout("w-old", "2026-11-02", {
            sets: [
              set("a1"),
              set("a2", { reps: 3, weightKg: 110, performedAt: "2026-11-02T10:05:00.000Z" }),
              set("a3", { completed: false, performedAt: "2026-11-02T10:10:00.000Z" }),
              set("a4", { exerciseId: "plank", kind: "timed", reps: null, weightKg: null, durationSec: 60, performedAt: "2026-11-02T10:15:00.000Z" }),
            ],
          }),
          workout("w-new", "2026-11-05", { status: "partial", plannedSets: 4, adapted: true }),
        ],
      });
      await call("POST", "/api/progress/sync", B, { workouts: [workout("w-b", "2026-11-04")] });

      const res = await history(A);
      expect(res.statusCode).toBe(200);
      const { workouts, nextCursor } = res.json();
      expect(nextCursor).toBeNull();
      expect(workouts.map((w: { id: string }) => w.id)).toEqual(["w-new", "w-old"]);
      expect(JSON.stringify(workouts)).not.toContain('"userId"');
      expect(workouts[0]).toMatchObject({ status: "partial", adapted: true, sets: [], summary: { totalSets: 0, completedSets: 0, exercises: [], volumeKg: 0 } });
      expect(workouts[1].sets.map((s: { id: string }) => s.id)).toEqual(["a1", "a2", "a3", "a4"]);
      // volume = completed weighted sets only: 5*100 + 3*110
      expect(workouts[1].summary).toEqual({ totalSets: 4, completedSets: 3, plannedSets: 3, exercises: ["squat", "plank"], volumeKg: 830, durationSec: 1500 });
    });

    it("filters by date range and status", async () => {
      await call("POST", "/api/progress/sync", A, {
        workouts: [workout("w1", "2026-11-01"), workout("w2", "2026-11-10", { status: "abandoned" }), workout("w3", "2026-11-20")],
      });
      const ids = async (qs: string) => (await history(A, qs)).json().workouts.map((w: { id: string }) => w.id);
      expect(await ids("?from=2026-11-05&to=2026-11-20")).toEqual(["w3", "w2"]);
      expect(await ids("?status=completed")).toEqual(["w3", "w1"]);
      expect(await ids("?to=2026-11-01")).toEqual(["w1"]);
    });

    it("paginates with limit and an opaque cursor, ties broken by id", async () => {
      await call("POST", "/api/progress/sync", A, {
        workouts: [workout("w1", "2026-11-01"), workout("w2", "2026-11-03"), workout("w3", "2026-11-03"), workout("w4", "2026-11-05"), workout("w5", "2026-11-07")],
      });
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const res = await history(A, `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        expect(res.statusCode).toBe(200);
        const page = res.json();
        seen.push(...page.workouts.map((w: { id: string }) => w.id));
        cursor = page.nextCursor;
        pages++;
      } while (cursor && pages < 10);
      expect(pages).toBe(3);
      expect(seen).toEqual(["w5", "w4", "w3", "w2", "w1"]);
    });

    it("rejects bad query params with 400", async () => {
      for (const qs of ["?limit=0", "?limit=201", "?from=nope", "?status=weird", "?cursor=%%%", "?cursor=bm9wZQ", "?extra=1"]) {
        expect((await history(A, qs)).statusCode, qs).toBe(400);
      }
      expect((await call("GET", "/api/progress/workouts", undefined)).statusCode).toBe(400);
    });
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

    it("concurrent change archives with the same hash write one row", async () => {
      const c = { period: "change", weekStart: null, takenAt: "2026-11-20T10:00:00.000Z", engineVersion: "2", payload: { n: 1 }, payloadHash: "same" };
      const res = await Promise.all([1, 2, 3, 4].map(() => call("POST", "/api/progress/archive", A, c)));
      expect(res.map((r) => r.statusCode).sort()).toEqual([200, 200, 200, 201]);
      expect(await count("user_progress_snapshots")).toBe(1);
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
