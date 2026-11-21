import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Knex } from "knex";
import { createDb, migrate, migrationConfig } from "../src/db.js";

const APP_TABLES = ["trainers", "user_device_data_snapshots", "user_devices", "user_trainings", "users"];

describe("DB schema migrations", () => {
  let container: StartedPostgreSqlContainer;
  let db: Knex;

  const tables = async (): Promise<string[]> => {
    const { rows } = await db.raw("select tablename from pg_tables where schemaname = 'public' and tablename not like 'knex_%' and tablename not like 'user_progress_%' order by tablename");
    return rows.map((r: { tablename: string }) => r.tablename);
  };
  const columns = async (table: string): Promise<Record<string, { type: string; nullable: boolean; default: string | null }>> => {
    const { rows } = await db.raw(
      "select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name = ?",
      [table],
    );
    return Object.fromEntries(
      rows.map((r: { column_name: string; data_type: string; is_nullable: string; column_default: string | null }) => [
        r.column_name,
        { type: r.data_type, nullable: r.is_nullable === "YES", default: r.column_default },
      ]),
    );
  };
  const indexes = async (table: string): Promise<string[]> => {
    const { rows } = await db.raw("select indexdef from pg_indexes where tablename = ?", [table]);
    return rows.map((r: { indexdef: string }) => r.indexdef.replace(/^.* USING /, ""));
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    db = createDb(container.getConnectionUri());
  });

  afterAll(async () => {
    await db?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await db.migrate.rollback(migrationConfig, true);
  });

  it("migrates an empty DB, rolls everything back, and migrates again", async () => {
    expect(await tables()).toEqual([]);
    await migrate(db);
    expect(await tables()).toEqual(APP_TABLES);
    await db.migrate.rollback(migrationConfig, true);
    expect(await tables()).toEqual([]);
    await migrate(db);
    expect(await tables()).toEqual(APP_TABLES);
  });

  it("creates every column with the specified type, nullability and default", async () => {
    await migrate(db);
    const tz = "timestamp with time zone";
    const ts = { created_at: { type: tz, nullable: false }, updated_at: { type: tz, nullable: false } };

    expect(await columns("trainers")).toMatchObject({
      id: { type: "bigint", nullable: false },
      slug: { type: "text", nullable: false },
      name: { type: "character varying", nullable: false },
      path_to_image: { type: "character varying", nullable: true },
      tov: { type: "text", nullable: true },
      ...ts,
    });
    expect(await columns("users")).toMatchObject({
      id: { type: "bigint", nullable: false },
      name: { type: "character varying", nullable: false },
      email: { type: "character varying", nullable: false },
      gender: { type: "character varying", nullable: true },
      dob: { type: "date", nullable: true },
      weight: { type: "numeric", nullable: true },
      height: { type: "numeric", nullable: true },
      trainer_id: { type: "bigint", nullable: true },
      level: { type: "character varying", nullable: true },
      days_per_week: { type: "smallint", nullable: true },
      duration_min: { type: "smallint", nullable: true },
      onboarding: { type: "jsonb", nullable: true },
      ...ts,
    });
    expect(await columns("user_devices")).toMatchObject({
      id: { type: "bigint", nullable: false },
      user_id: { type: "bigint", nullable: false },
      title: { type: "character varying", nullable: false },
      creds: { type: "jsonb", nullable: true },
      ...ts,
    });
    expect(await columns("user_trainings")).toMatchObject({
      id: { type: "bigint", nullable: false },
      user_id: { type: "bigint", nullable: false },
      trainer_id: { type: "bigint", nullable: true },
      plan_data: { type: "jsonb", nullable: false },
      passed: { type: "boolean", nullable: false, default: "false" },
      ...ts,
    });
    const snapshots = await columns("user_device_data_snapshots");
    expect(Object.keys(snapshots).sort()).toEqual(["created_at", "data", "device_id", "id", "user_id"]);
    expect(snapshots).toMatchObject({
      user_id: { type: "bigint", nullable: false },
      device_id: { type: "bigint", nullable: false },
      data: { type: "jsonb", nullable: false },
      created_at: { type: tz, nullable: false },
    });

    for (const table of APP_TABLES) {
      expect((await columns(table)).id.default).toMatch(/^nextval\(/);
      expect((await columns(table)).created_at.default).toBe("CURRENT_TIMESTAMP");
    }
    const { rows } = await db.raw("select numeric_precision, numeric_scale from information_schema.columns where table_name = 'users' and column_name in ('weight', 'height')");
    expect(rows).toEqual([{ numeric_precision: 5, numeric_scale: 2 }, { numeric_precision: 5, numeric_scale: 2 }]);
  });

  it("creates the specified indexes", async () => {
    await migrate(db);
    expect(await indexes("users")).toEqual(expect.arrayContaining(["btree (email)", "btree (trainer_id)"]));
    expect(await indexes("user_devices")).toContain("btree (user_id)");
    expect(await indexes("user_trainings")).toContain("btree (user_id, created_at)");
    expect(await indexes("user_device_data_snapshots")).toEqual(
      expect.arrayContaining(["btree (user_id, created_at)", "btree (device_id, created_at)"]),
    );
  });

  it("enforces FKs: user delete cascades, trainer delete nulls, device delete cascades snapshots", async () => {
    await migrate(db);
    const [trainer] = await db("trainers").insert({ slug: "t", name: "T", sortOrder: 0 }).returning("id");
    const [user] = await db("users").insert({ name: "U", email: "u@example.com", trainerId: trainer.id }).returning("id");
    const [device] = await db("user_devices").insert({ userId: user.id, title: "Apple Watch", creds: { token: "x" } }).returning("id");
    const [training] = await db("user_trainings")
      .insert({ userId: user.id, trainerId: trainer.id, planData: JSON.stringify({ days: [] }) })
      .returning(["id", "passed"]);
    expect(training.passed).toBe(false);
    await db("user_device_data_snapshots").insert({ userId: user.id, deviceId: device.id, data: { hr: 60 } });

    await expect(db("users").insert({ name: "Dup", email: "u@example.com" })).rejects.toThrow(/users_email_unique/);
    await expect(db("user_trainings").insert({ userId: user.id })).rejects.toThrow(/plan_data/);
    await db("users").where({ id: user.id }).update({ daysPerWeek: 3, durationMin: 45 });
    await expect(db("users").where({ id: user.id }).update({ daysPerWeek: 8 })).rejects.toThrow(/users_days_per_week_check/);
    await expect(db("users").where({ id: user.id }).update({ durationMin: 0 })).rejects.toThrow(/users_duration_min_check/);

    await db("trainers").where({ id: trainer.id }).delete();
    expect((await db("users").where({ id: user.id }).first()).trainerId).toBeNull();
    expect((await db("user_trainings").where({ id: training.id }).first()).trainerId).toBeNull();

    await db("user_devices").where({ id: device.id }).delete();
    expect(await db("user_device_data_snapshots").count("* as n")).toEqual([{ n: "0" }]);

    const [device2] = await db("user_devices").insert({ userId: user.id, title: "Garmin" }).returning("id");
    await db("user_device_data_snapshots").insert({ userId: user.id, deviceId: device2.id, data: {} });
    await db("users").where({ id: user.id }).delete();
    for (const table of ["user_devices", "user_trainings", "user_device_data_snapshots"]) {
      expect(await db(table).count("* as n")).toEqual([{ n: "0" }]);
    }
  });

  it("reshapes an existing trainers table without losing rows, and the rollback restores it", async () => {
    // State of production before this change: 20261121 + 20261122 applied, rows keyed by text id.
    await db.migrate.up(migrationConfig);
    await db.migrate.up(migrationConfig);
    const legacy = [
      { id: "john", name: "John", pathToImage: "/trainers/john.svg", tov: "Supportive.", sortOrder: 1 },
      { id: "mike", name: "Mike", pathToImage: "/trainers/mike.svg", tov: "Blunt.", sortOrder: 0 },
      { id: "alex", name: "Alex", pathToImage: "/trainers/alex.svg", tov: "Curious.", sortOrder: 2 },
    ];
    await db("trainers").insert(legacy);

    await migrate(db);
    const rows = await db("trainers").orderBy("id").select("id", "slug", "name", "pathToImage", "tov");
    expect(rows).toEqual([
      { id: "1", slug: "mike", name: "Mike", pathToImage: "/trainers/mike.svg", tov: "Blunt." },
      { id: "2", slug: "john", name: "John", pathToImage: "/trainers/john.svg", tov: "Supportive." },
      { id: "3", slug: "alex", name: "Alex", pathToImage: "/trainers/alex.svg", tov: "Curious." },
    ]);
    const [next] = await db("trainers").insert({ slug: "new", name: "New", sortOrder: 3 }).returning("id");
    expect(next.id).toBe("4"); // sequence continues after the backfilled ids
    await expect(db("trainers").insert({ slug: "mike", name: "Dup", sortOrder: 9 })).rejects.toThrow(/trainers_slug_unique/);
    await db("trainers").where({ slug: "new" }).delete();

    await db.migrate.rollback(migrationConfig); // last batch = the 20261123 and later migrations
    expect(await tables()).toEqual(["trainers"]);
    expect(Object.keys(await columns("trainers")).sort()).toEqual(["id", "name", "path_to_image", "sort_order", "tov"]);
    expect(await db("trainers").orderBy("sortOrder")).toEqual(
      [legacy[1], legacy[0], legacy[2]],
    );
  });
});
