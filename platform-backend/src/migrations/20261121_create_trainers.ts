import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable("trainers", (t) => {
    t.text("id").primary();
    t.text("name").notNullable();
    t.text("icon_path").notNullable();
    t.text("description").notNullable();
    t.integer("sort_order").notNullable();
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable("trainers");
}
