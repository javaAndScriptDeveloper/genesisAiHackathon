import type { Knex } from "knex";

// Opaque client ids of the compared photos (text only). The photos themselves are never stored: still no image columns.
export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("user_progress_photo_insights", (t) => {
    t.text("before_photo_id").nullable();
    t.text("after_photo_id").nullable();
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.alterTable("user_progress_photo_insights", (t) => {
    t.dropColumns("before_photo_id", "after_photo_id");
  });
}
