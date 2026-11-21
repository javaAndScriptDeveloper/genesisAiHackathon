import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Knex } from "knex";
import { buildApp } from "../src/app.js";
import { createDb, migrate } from "../src/db.js";
import { seedTrainers } from "../src/trainers.js";

describe("GET /api/trainers", () => {
  let container: StartedPostgreSqlContainer;
  let db: Knex;

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

  it("returns the 5 seeded trainers in order", async () => {
    const res = await buildApp(db).inject({ method: "GET", url: "/api/trainers" });
    expect(res.statusCode).toBe(200);
    const { trainers } = res.json();
    expect(trainers.map((t: { name: string }) => t.name)).toEqual(["Mike", "John", "Hanna", "Caroline", "Alex"]);
    for (const t of trainers) {
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.iconPath).toMatch(/^\/trainers\/[a-z]+\.svg$/);
    }
  });

  it("migrate and seed are idempotent", async () => {
    await migrate(db);
    await seedTrainers(db);
    const [{ count }] = await db("trainers").count<{ count: string }[]>("* as count");
    expect(Number(count)).toBe(5);
  });

  it("returns 503 when the database fails", async () => {
    const broken = createDb("postgres://x:x@127.0.0.1:1/x");
    const res = await buildApp(broken).inject({ method: "GET", url: "/api/trainers" });
    await broken.destroy();
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "trainers unavailable" });
  });
});
