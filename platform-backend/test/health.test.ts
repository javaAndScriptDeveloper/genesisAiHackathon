import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Knex } from "knex";
import { buildApp } from "../src/app.js";
import { createDb } from "../src/db.js";

describe("GET /api/health", () => {
  let container: StartedPostgreSqlContainer;
  let pool: Knex;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    pool = createDb(container.getConnectionUri());
  });

  afterAll(async () => {
    await pool?.destroy();
    await container?.stop();
  });

  it("returns ok when the database answers SELECT 1", async () => {
    const app = buildApp(pool);
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", db: true });
  });

  it("returns 503 when the database is unreachable", async () => {
    const broken = createDb("postgres://x:x@127.0.0.1:1/x");
    const app = buildApp(broken);
    const res = await app.inject({ method: "GET", url: "/api/health" });
    await broken.destroy();
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "error", db: false });
  });

  it("answers /api/ping with a pong from platform-backend", async () => {
    const app = buildApp(pool);
    const res = await app.inject({ method: "GET", url: "/api/ping" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.message).toBe("pong from platform-backend");
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });
});
