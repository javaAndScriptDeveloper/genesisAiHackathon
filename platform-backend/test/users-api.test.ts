import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Knex } from "knex";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { createDb, migrate, migrationConfig } from "../src/db.js";
import { seedTrainers } from "../src/trainers.js";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const profile = () => ({ name: "Kate", gender: "female", weightKg: 62.5, heightCm: 170, level: "beginner", trainerId: "hanna" });

describe("users API", () => {
  let container: StartedPostgreSqlContainer;
  let db: Knex;
  let app: FastifyInstance;

  const call = (token: string | undefined, payload: unknown) =>
    app.inject({ method: "POST", url: "/api/users", headers: token ? { "x-progress-token": token } : {}, payload: payload as object });
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
    await seedTrainers(db);
  });

  it("rejects a missing or non-UUID token with 400", async () => {
    for (const token of [undefined, "nope"]) expect((await call(token, profile())).statusCode).toBe(400);
  });

  it("creates the user from the onboarding profile and links the trainer by slug", async () => {
    const res = await call(A, profile());
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ user: { name: "Kate", gender: "female", weightKg: 62.5, heightCm: 170, level: "beginner", trainerId: "hanna" } });
    const row = await db("users").join("trainers", "trainers.id", "users.trainer_id").first("users.name", "users.weight", "users.height", "trainers.slug");
    expect(row).toMatchObject({ name: "Kate", weight: 62.5, height: 170, slug: "hanna" });
  });

  it("is idempotent per token: a second call updates the same user", async () => {
    await call(A, profile());
    const res = await call(A, { ...profile(), name: "Katerina", weightKg: 60 });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ name: "Katerina", weightKg: 60 });
    expect(await count("users")).toBe(1);
  });

  it("upgrades the guest user that progress sync already created", async () => {
    await app.inject({ method: "POST", url: "/api/progress/sync", headers: { "x-progress-token": A }, payload: { settings: { weeklyGoal: 4 } } });
    expect(await count("users")).toBe(1);
    expect((await call(A, profile())).statusCode).toBe(200);
    expect(await count("users")).toBe(1);
    expect((await db("users").first("name")).name).toBe("Kate");
  });

  it("gives different tokens different users", async () => {
    await call(A, profile());
    await call(B, profile());
    expect(await count("users")).toBe(2);
  });

  it("accepts a profile without optional fields and ignores no trainer", async () => {
    const res = await call(A, { name: "Kate" });
    expect(res.statusCode).toBe(201);
    expect(res.json().user).toEqual({ name: "Kate", gender: null, weightKg: null, heightCm: null, level: null, trainerId: null });
  });

  it("rejects bad input with 400 and creates nothing", async () => {
    for (const bad of [{}, { name: "" }, { name: "x", weightKg: -1 }, { name: "x", extra: 1 }, { name: "x", level: "god" }]) {
      expect((await call(A, bad)).statusCode).toBe(400);
    }
    expect(await count("users")).toBe(0);
  });

  it("rejects an unknown trainer with 400", async () => {
    expect((await call(A, { name: "Kate", trainerId: "nobody" })).statusCode).toBe(400);
    expect(await count("users")).toBe(0);
  });
});
