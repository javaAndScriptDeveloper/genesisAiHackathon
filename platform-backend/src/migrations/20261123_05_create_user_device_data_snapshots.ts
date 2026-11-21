import type { Knex } from "knex";

// Append-only: rows are inserted, never updated, hence no updated_at.
export async function up(db: Knex): Promise<void> {
  await db.schema.createTable("user_device_data_snapshots", (t) => {
    t.comment("Append-only device data snapshots; rows are never updated.");
    t.bigIncrements("id");
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.bigInteger("device_id").notNullable().references("id").inTable("user_devices").onDelete("CASCADE");
    t.jsonb("data").notNullable();
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(db.fn.now());
    t.index(["user_id", "created_at"]);
    t.index(["device_id", "created_at"]);
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable("user_device_data_snapshots");
}
