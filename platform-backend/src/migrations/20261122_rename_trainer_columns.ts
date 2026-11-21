import type { Knex } from "knex";

// icon_path -> path_to_image, description -> tov. A new migration (not an edit of the first one) so databases
// that already ran 20261121 keep their rows.
export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("trainers", (t) => {
    t.renameColumn("icon_path", "path_to_image");
    t.renameColumn("description", "tov");
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.alterTable("trainers", (t) => {
    t.renameColumn("path_to_image", "icon_path");
    t.renameColumn("tov", "description");
  });
}
