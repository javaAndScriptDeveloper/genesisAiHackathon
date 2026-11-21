import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { FastifyInstance } from "fastify";
import type { Knex } from "knex";
import { buildApp } from "../src/app.js";
import { createDb, migrate } from "../src/db.js";
import { resolveUser } from "../src/progress/repo.js";
import { seedTrainers } from "../src/trainers.js";

describe("token-scoped devices, snapshots and trainings (/api/me)", () => {
  let container: StartedPostgreSqlContainer;
  let db: Knex;
  let app: FastifyInstance;

  const req = (method: "GET" | "POST", url: string, token: string | undefined, payload?: object) =>
    app.inject({ method, url, headers: token ? { "x-progress-token": token } : {}, ...(payload ? { payload } : {}) });
  const userIdOf = async (token: string) => (await resolveUser(db, token, { create: false })) as number;
  const count = async (t: string): Promise<number> => Number((await db(t).count("* as n"))[0].n);

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    db = createDb(container.getConnectionUri());
    await migrate(db);
    await seedTrainers(db);
    app = buildApp(db);
  });

  afterAll(async () => {
    await app?.close();
    await db?.destroy();
    await container?.stop();
  });

  it("rejects a missing or non-UUID token with 400 on every route", async () => {
    for (const token of [undefined, "nope"]) {
      expect((await req("POST", "/api/me/devices", token, { title: "Watch" })).statusCode).toBe(400);
      expect((await req("POST", "/api/me/devices/1/sync", token, { date: "2026-11-21" })).statusCode).toBe(400);
      expect((await req("GET", "/api/me/snapshots", token)).statusCode).toBe(400);
      expect((await req("POST", "/api/me/trainings", token, { trainerSlug: null, planData: {} })).statusCode).toBe(400);
      expect((await req("GET", "/api/me/trainings/latest", token)).statusCode).toBe(400);
    }
  });

  it("creates a device for the token's user, creating the guest user when needed, and never returns users.id", async () => {
    const token = randomUUID();
    const res = await req("POST", "/api/me/devices", token, { title: "Apple Watch" });
    expect(res.statusCode).toBe(201);
    expect(Object.keys(res.json())).toEqual(["id"]);
    const row = await db("user_devices").where({ id: res.json().id }).first();
    expect(Number(row.userId)).toBe(await userIdOf(token));
    expect(row.title).toBe("Apple Watch");
  });

  it("the device belongs to the same user as POST /api/users with that token", async () => {
    const token = randomUUID();
    expect((await req("POST", "/api/users", token, { name: "Ann", onboarding: { goal: "build-muscle" } })).statusCode).toBe(201);
    const users = await count("users");
    const device = (await req("POST", "/api/me/devices", token, { title: "Garmin" })).json();
    expect(await count("users")).toBe(users);
    const row = await db("user_devices").where({ id: device.id }).first();
    expect((await db("users").where({ id: row.userId }).first()).name).toBe("Ann");
  });

  it("rejects a bad device body", async () => {
    const token = randomUUID();
    expect((await req("POST", "/api/me/devices", token, {})).statusCode).toBe(400);
    expect((await req("POST", "/api/me/devices", token, { title: "x", extra: 1 })).statusCode).toBe(400);
  });

  describe("device sync and snapshots", () => {
    const setup = async () => {
      const token = randomUUID();
      const deviceId = (await req("POST", "/api/me/devices", token, { title: "Watch" })).json().id as number;
      const sync = (payload: object, did: number | string = deviceId, tk = token) => req("POST", `/api/me/devices/${did}/sync`, tk, payload);
      const snaps = async (q = "") => (await req("GET", `/api/me/snapshots${q}`, token)).json().snapshots;
      const rows = async () => db("user_device_data_snapshots").where({ userId: await userIdOf(token) });
      return { token, deviceId, sync, snaps, rows };
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
      expect(await snaps()).toHaveLength(7); // days defaults to 7
    });

    it("bad-night sync replaces today (latest row per date wins)", async () => {
      const { sync, snaps, rows } = await setup();
      await sync({ date: "2026-11-21" });
      await sync({ date: "2026-11-21", scenario: "bad-night" });
      const list = await snaps("?days=7");
      expect(list).toHaveLength(7);
      expect(list[6].scenario).toBe("bad-night");
      expect(list[6].readiness).toBeLessThan(40);
      expect(await rows()).toHaveLength(8);
    });

    it("a sync without scenario keeps an existing bad night for that date", async () => {
      const { sync, snaps, rows } = await setup();
      await sync({ date: "2026-11-21", scenario: "bad-night" });
      const before = (await rows()).length;
      const res = await sync({ date: "2026-11-21" });
      expect(res.statusCode).toBe(200);
      expect(res.json().snapshot.scenario).toBe("bad-night");
      expect(res.json().snapshot.readiness).toBeLessThan(40);
      const list = await snaps("?days=7");
      expect(list[6].scenario).toBe("bad-night");
      expect(list[6].readiness).toBeLessThan(40);
      expect(await rows()).toHaveLength(before);
    });

    it("an explicit scenario still appends a new row", async () => {
      const { sync, snaps, rows } = await setup();
      await sync({ date: "2026-11-21", scenario: "bad-night" });
      const res = await sync({ date: "2026-11-21", scenario: "normal" });
      expect(res.json().snapshot.scenario).toBe("normal");
      expect((await snaps("?days=7"))[6].scenario).toBe("normal");
      expect(await rows()).toHaveLength(8);
    });

    it("sync rejects a device of another token's user with 404, and leaves no guest user behind", async () => {
      const a = await setup();
      const b = await setup();
      expect((await a.sync({ date: "2026-11-21" }, b.deviceId)).statusCode).toBe(404);
      expect((await a.sync({ date: "2026-11-21" }, 999999999)).statusCode).toBe(404);
      const users = await count("users");
      expect((await a.sync({ date: "2026-11-21" }, b.deviceId, randomUUID())).statusCode).toBe(404);
      expect(await count("users")).toBe(users);
    });

    it("sync rejects invalid dates, scenarios and device ids", async () => {
      const { sync } = await setup();
      expect((await sync({ date: "2026-02-30" })).statusCode).toBe(400);
      expect((await sync({ date: "nope" })).statusCode).toBe(400);
      expect((await sync({ date: "2026-11-21", scenario: "x" })).statusCode).toBe(400);
      expect((await sync({ date: "2026-11-21", extra: 1 })).statusCode).toBe(400);
      expect((await sync({ date: "2026-11-21" }, "abc")).statusCode).toBe(400);
      expect((await sync({ date: "2026-11-21" }, 0)).statusCode).toBe(400);
    });

    it("snapshots validates days and is empty for an unknown token", async () => {
      const { snaps, token } = await setup();
      expect(await snaps()).toEqual([]);
      for (const q of ["?days=40", "?days=0", "?days=x", "?other=1"]) expect((await req("GET", `/api/me/snapshots${q}`, token)).statusCode).toBe(400);
      const users = await count("users");
      const unknown = await req("GET", "/api/me/snapshots?days=7", randomUUID());
      expect(unknown.statusCode).toBe(200);
      expect(unknown.json()).toEqual({ snapshots: [] });
      expect(await count("users")).toBe(users);
    });

    it("snapshots are per token", async () => {
      const a = await setup();
      const b = await setup();
      await a.sync({ date: "2026-11-21" });
      expect(await a.snaps()).toHaveLength(7);
      expect(await b.snaps()).toEqual([]);
    });
  });

  describe("training versions", () => {
    const save = (token: string, payload: object) => req("POST", "/api/me/trainings", token, payload);
    const latest = (token: string) => req("GET", "/api/me/trainings/latest", token);

    it("returns null for an unknown token without creating a user", async () => {
      const users = await count("users");
      const res = await latest(randomUUID());
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ training: null });
      expect(await count("users")).toBe(users);
    });

    it("saves versions and returns the latest one with the trainer slug", async () => {
      const token = randomUUID();
      const first = await save(token, { trainerSlug: "hanna", planData: { kind: "plan" } });
      expect(first.statusCode).toBe(201);
      expect(typeof first.json().id).toBe("number");
      const second = await save(token, { trainerSlug: "alex", planData: { kind: "daily-adjust" } });
      expect(second.statusCode).toBe(201);
      const { training } = (await latest(token)).json();
      expect(training.id).toBe(second.json().id);
      expect(training.trainerSlug).toBe("alex");
      expect(training.planData.kind).toBe("daily-adjust");
      expect(typeof training.createdAt).toBe("string");
      expect((await latest(randomUUID())).json()).toEqual({ training: null });
    });

    it("stores a null trainer for an unknown or null slug", async () => {
      const token = randomUUID();
      expect((await save(token, { trainerSlug: "nobody", planData: { kind: "plan" } })).statusCode).toBe(201);
      expect((await latest(token)).json().training.trainerSlug).toBeNull();
      expect((await save(token, { trainerSlug: null, planData: {} })).statusCode).toBe(201);
    });

    it("rejects a body without planData or with extra fields", async () => {
      const token = randomUUID();
      expect((await save(token, { trainerSlug: "alex" })).statusCode).toBe(400);
      expect((await save(token, { trainerSlug: "alex", planData: {}, userId: 1 })).statusCode).toBe(400);
    });
  });
});
