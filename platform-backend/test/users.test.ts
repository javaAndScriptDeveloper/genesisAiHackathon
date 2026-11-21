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
});
