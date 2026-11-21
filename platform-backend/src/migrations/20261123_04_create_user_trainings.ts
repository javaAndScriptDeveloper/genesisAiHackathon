import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable("user_trainings", (t) => {
    t.bigIncrements("id");
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.bigInteger("trainer_id").nullable().references("id").inTable("trainers").onDelete("SET NULL");
    t.jsonb("plan_data").notNullable();
    t.boolean("passed").notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.index(["user_id", "created_at"]); // also covers lookups by user_id alone
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable("user_trainings");
}
