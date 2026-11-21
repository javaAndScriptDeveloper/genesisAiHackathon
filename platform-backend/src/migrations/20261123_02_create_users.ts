import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable("users", (t) => {
    t.bigIncrements("id");
    t.string("name").notNullable();
    t.string("email").notNullable().unique();
    t.string("gender").nullable();
    t.date("dob").nullable(); // date of birth, not age
    t.decimal("weight", 5, 2).nullable(); // kg
    t.decimal("height", 5, 2).nullable(); // cm
    t.bigInteger("trainer_id").nullable().references("id").inTable("trainers").onDelete("SET NULL").index();
    t.string("level").nullable(); // beginner / intermediate / advanced
    t.timestamps(true, true);
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable("users");
}
