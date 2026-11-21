import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Knex } from "knex";
import { buildApp } from "../src/app.js";
import { createDb, migrate, migrationConfig } from "../src/db.js";
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
      expect(t.tov.length).toBeGreaterThan(0);
      expect(t.pathToImage).toMatch(/^\/trainers\/[a-z]+\.svg$/);
    }
  });

  it("returns the slug as the trainer id", async () => {
    const res = await buildApp(db).inject({ method: "GET", url: "/api/trainers" });
    expect(res.json().trainers.map((t: { id: string }) => t.id)).toEqual(["mike", "john", "hanna", "caroline", "alex"]);
  });

  it("has the columns id, slug, name, path_to_image, tov, sort_order and timestamps", async () => {
    const { rows } = await db.raw("select column_name from information_schema.columns where table_name = 'trainers' order by column_name");
    expect(rows.map((r: { column_name: string }) => r.column_name)).toEqual(["created_at", "id", "name", "path_to_image", "slug", "sort_order", "tov", "updated_at"]);
  });

  it("the rename migration keeps rows written under the old column names", async () => {
    await db.migrate.rollback(migrationConfig, true);
    await db.migrate.up(migrationConfig);
    await db.raw("insert into trainers (id, name, icon_path, description, sort_order) values ('legacy', 'Legacy', '/trainers/legacy.svg', 'old tone', 9)");
    await migrate(db);
    const row = await db("trainers").where({ slug: "legacy" }).first();
    expect(row).toMatchObject({ name: "Legacy", pathToImage: "/trainers/legacy.svg", tov: "old tone" });
    await db("trainers").where({ slug: "legacy" }).delete();
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
