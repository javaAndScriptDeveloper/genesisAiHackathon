import type { Knex } from "knex";

// Append-only archive: rows are inserted, never updated or deleted, hence no updated_at.
export async function up(db: Knex): Promise<void> {
  await db.schema.createTable("user_progress_snapshots", (t) => {
    t.comment("Append-only progress snapshots; rows are never updated or deleted.");
    t.bigIncrements("id");
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.text("period").notNullable();
    t.date("week_start").nullable();
    t.timestamp("taken_at", { useTz: true }).notNullable().defaultTo(db.fn.now());
    t.text("engine_version").notNullable();
    t.jsonb("payload").notNullable();
    t.text("payload_hash").notNullable();
    t.index(["user_id", "taken_at"]);
    t.check("period in ('weekly', 'change')", [], "user_progress_snapshots_period_check");
  });
  await db.raw("create unique index user_progress_snapshots_weekly_unique on user_progress_snapshots (user_id, week_start) where period = 'weekly'");
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable("user_progress_snapshots");
}
