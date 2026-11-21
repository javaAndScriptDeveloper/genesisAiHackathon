import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable("user_devices", (t) => {
    t.bigIncrements("id");
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE").index();
    t.string("title").notNullable(); // e.g. "Garmin Forerunner", "Apple Watch"
    // TODO: encrypt at the application level before writing (e.g. AES-GCM with a key from env), and never log this column.
    t.jsonb("creds").nullable().comment("Device/API credentials. Sensitive: never log. TODO app-level encryption.");
    t.timestamps(true, true);
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable("user_devices");
}
