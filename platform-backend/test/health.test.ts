import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { buildApp } from "../src/app.js";

describe("GET /api/health", () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it("returns ok when the database answers SELECT 1", async () => {
    const app = buildApp(pool);
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", db: true });
  });

  it("returns 503 when the database is unreachable", async () => {
    const app = buildApp({ query: () => Promise.reject(new Error("connection refused")) });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "error", db: false });
  });
});
