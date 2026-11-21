import type { Knex } from "knex";

// Check-in journal (weigh-ins, goal changes, photo metadata). Photos are metadata only: no image columns by design.
export async function up(db: Knex): Promise<void> {
  await db.schema.createTable("user_progress_checkins", (t) => {
    t.text("id").primary();
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.text("kind").notNullable();
    t.date("date").notNullable();
    t.timestamp("taken_at", { useTz: true }).notNullable();
    t.decimal("weight_kg", 5, 2).nullable();
    t.decimal("goal_kg", 5, 2).nullable();
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(db.fn.now());
    t.index(["user_id", "taken_at"]);
    t.check("kind in ('weight', 'goal', 'photo')", [], "user_progress_checkins_kind_check");
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable("user_progress_checkins");
}
