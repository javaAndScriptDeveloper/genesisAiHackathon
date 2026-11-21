import type { Knex } from "knex";

// AI photo-analysis RESULTS only (text). The photos themselves are never stored: no image columns by design.
export async function up(db: Knex): Promise<void> {
  await db.schema.createTable("user_progress_photo_insights", (t) => {
    t.text("id").primary();
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.timestamp("analyzed_at", { useTz: true }).notNullable();
    t.date("before_date").notNullable();
    t.date("after_date").notNullable();
    t.decimal("before_weight_kg", 5, 2).nullable();
    t.decimal("after_weight_kg", 5, 2).nullable();
    t.text("model").notNullable();
    t.text("engine_version").notNullable();
    t.boolean("suitable").notNullable();
    t.jsonb("result").notNullable();
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(db.fn.now());
    t.index(["user_id", "analyzed_at"]);
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable("user_progress_photo_insights");
}
