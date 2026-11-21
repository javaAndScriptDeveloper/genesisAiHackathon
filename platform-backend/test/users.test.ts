import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Knex } from "knex";
import { buildApp } from "../src/app.js";
import { createDb, migrate } from "../src/db.js";
import { seedTrainers } from "../src/trainers.js";

describe("users and devices endpoints", () => {
  let container: StartedPostgreSqlContainer;
  let db: Knex;

  const body = {
    name: "Ann",
    gender: "female",
    dob: "1990-05-17",
    weightKg: 80,
    heightCm: 175,
    level: "beginner",
    trainerSlug: "hanna",
    onboarding: { goal: "build-muscle" },
  };
  const create = async (payload: object = body) =>
    buildApp(db).inject({ method: "POST", url: "/api/users", payload });

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    db = createDb(container.getConnectionUri());
    await migrate(db);
    await seedTrainers(db);
  });

  afterAll(async () => {
    await db?.destroy();
    await container?.stop();
  });

  it("creates a user with onboarding and trainer", async () => {
    const res = await create();
    expect(res.statusCode).toBe(201);
    const { id } = res.json();
    expect(typeof id).toBe("number");
    const row = await db("users").where({ id }).first();
    const hanna = await db("trainers").where({ slug: "hanna" }).first();
    expect(row.email).toMatch(/^demo-[0-9a-f]{12}@demo\.local$/);
    expect(row.trainerId).toBe(hanna.id);
    expect(row.onboarding.goal).toBe("build-muscle");
    expect(row.weight).toBe("80.00");
  });

  it("two users get different emails", async () => {
    const a = await create();
    const b = await create();
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
  });

  it("unknown trainer slug stores null", async () => {
    const res = await create({ ...body, trainerSlug: "nobody" });
    expect(res.statusCode).toBe(201);
    expect((await db("users").where({ id: res.json().id }).first()).trainerId).toBeNull();
  });

  it("rejects a body without name", async () => {
    const { name: _name, ...noName } = body;
    expect((await create(noName)).statusCode).toBe(400);
  });

  it("patches fields and trainer", async () => {
    const { id } = (await create()).json();
    const before = await db("users").where({ id }).first();
    const res = await buildApp(db).inject({ method: "PATCH", url: `/api/users/${id}`, payload: { weightKg: 78.5, trainerSlug: "mike" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id });
    const row = await db("users").where({ id }).first();
    const mike = await db("trainers").where({ slug: "mike" }).first();
    expect(row.weight).toBe("78.50");
    expect(row.trainerId).toBe(mike.id);
    expect(row.name).toBe("Ann");
    expect(row.updatedAt.getTime()).toBeGreaterThan(before.createdAt.getTime());
  });

  it("patch unknown user", async () => {
    const res = await buildApp(db).inject({ method: "PATCH", url: "/api/users/999999", payload: { name: "X" } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "user not found" });
  });

  it("creates a device", async () => {
    const { id: userId } = (await create()).json();
    const res = await buildApp(db).inject({ method: "POST", url: `/api/users/${userId}/devices`, payload: { title: "Apple Watch" } });
    expect(res.statusCode).toBe(201);
    const row = await db("user_devices").where({ id: res.json().id }).first();
    expect(row.userId).toBe(String(userId));

    const missing = await buildApp(db).inject({ method: "POST", url: "/api/users/999999/devices", payload: { title: "X" } });
    expect(missing.statusCode).toBe(404);
  });

  describe("device sync and snapshots", () => {
    const setup = async () => {
      const app = buildApp(db);
      const userId = (await create()).json().id;
      const deviceId = (await app.inject({ method: "POST", url: `/api/users/${userId}/devices`, payload: { title: "Watch" } })).json().id;
      const sync = (payload: object, uid = userId, did = deviceId) =>
        app.inject({ method: "POST", url: `/api/users/${uid}/devices/${did}/sync`, payload });
      const snaps = async (q = "") => (await app.inject({ method: "GET", url: `/api/users/${userId}/snapshots${q}` })).json().snapshots;
      return { userId, deviceId, sync, snaps };
    };

    it("sync backfills a week", async () => {
      const { sync, snaps } = await setup();
      const res = await sync({ date: "2026-11-21" });
      expect(res.statusCode).toBe(200);
      expect(res.json().snapshot.date).toBe("2026-11-21");
      const list = await snaps("?days=7");
      expect(list.map((s: { date: string }) => s.date)).toEqual(
        ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"],
      );
      expect(list.every((s: { source: string }) => s.source === "demo")).toBe(true);
    });

    it("bad-night sync replaces today", async () => {
      const { userId, sync, snaps } = await setup();
      await sync({ date: "2026-11-21" });
      await sync({ date: "2026-11-21", scenario: "bad-night" });
      const list = await snaps("?days=7");
      expect(list).toHaveLength(7);
      expect(list[6].scenario).toBe("bad-night");
      expect(list[6].readiness).toBeLessThan(40);
      expect(await db("user_device_data_snapshots").where({ userId })).toHaveLength(8);
    });

    it("a sync without scenario keeps an existing bad night for that date", async () => {
      const { userId, sync, snaps } = await setup();
      await sync({ date: "2026-11-21", scenario: "bad-night" });
      const count = (await db("user_device_data_snapshots").where({ userId })).length;
      const res = await sync({ date: "2026-11-21" });
      expect(res.statusCode).toBe(200);
      expect(res.json().snapshot.scenario).toBe("bad-night");
      expect(res.json().snapshot.readiness).toBeLessThan(40);
      const list = await snaps("?days=7");
      expect(list[6].scenario).toBe("bad-night");
      expect(list[6].readiness).toBeLessThan(40);
      expect(await db("user_device_data_snapshots").where({ userId })).toHaveLength(count);
    });

    it("an explicit scenario still appends a new row", async () => {
      const { userId, sync, snaps } = await setup();
      await sync({ date: "2026-11-21", scenario: "bad-night" });
      const res = await sync({ date: "2026-11-21", scenario: "normal" });
      expect(res.json().snapshot.scenario).toBe("normal");
      expect((await snaps("?days=7"))[6].scenario).toBe("normal");
      expect(await db("user_device_data_snapshots").where({ userId })).toHaveLength(8);
    });

    it("sync rejects a device of another user", async () => {
      const a = await setup();
      const b = await setup();
      expect((await a.sync({ date: "2026-11-21" }, a.userId, b.deviceId)).statusCode).toBe(404);
    });

    it("sync rejects invalid dates and scenarios", async () => {
      const { sync } = await setup();
      expect((await sync({ date: "2026-02-30" })).statusCode).toBe(400);
      expect((await sync({ date: "nope" })).statusCode).toBe(400);
      expect((await sync({ date: "2026-11-21", scenario: "x" })).statusCode).toBe(400);
    });

    it("snapshots validates days", async () => {
      const { snaps, userId } = await setup();
      expect(await snaps()).toEqual([]);
      const res = await buildApp(db).inject({ method: "GET", url: `/api/users/${userId}/snapshots?days=40` });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("training versions", () => {
    let userId: number;
    const latest = (id: number) => buildApp(db).inject({ method: "GET", url: `/api/users/${id}/trainings/latest` });
    const save = (id: number, payload: object) =>
      buildApp(db).inject({ method: "POST", url: `/api/users/${id}/trainings`, payload });

    beforeAll(async () => {
      userId = (await create()).json().id;
    });

    it("returns null when the user has no versions", async () => {
      const res = await latest(userId);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ training: null });
    });

    it("saves versions and returns the latest one with the trainer slug", async () => {
      const first = await save(userId, { trainerSlug: "hanna", planData: { kind: "plan" } });
      expect(first.statusCode).toBe(201);
      expect(typeof first.json().id).toBe("number");
      const second = await save(userId, { trainerSlug: "alex", planData: { kind: "daily-adjust" } });
      expect(second.statusCode).toBe(201);
      const res = await latest(userId);
      const { training } = res.json();
      expect(training.id).toBe(second.json().id);
      expect(training.trainerSlug).toBe("alex");
      expect(training.planData.kind).toBe("daily-adjust");
      expect(typeof training.createdAt).toBe("string");
    });

    it("stores null trainer for unknown or null slug", async () => {
      const other = (await create()).json().id;
      const res = await save(other, { trainerSlug: "nobody", planData: { kind: "plan" } });
      expect(res.statusCode).toBe(201);
      expect((await latest(other)).json().training.trainerSlug).toBeNull();
      expect((await save(other, { trainerSlug: null, planData: {} })).statusCode).toBe(201);
    });

    it("returns 404 for an unknown user", async () => {
      expect((await save(999999, { trainerSlug: null, planData: {} })).statusCode).toBe(404);
    });

    it("rejects a body without planData", async () => {
      expect((await save(userId, { trainerSlug: "alex" })).statusCode).toBe(400);
    });
  });
});
