import type { Knex } from "knex";

// Brings the existing `trainers` table (created in 20261121 with a text PK like 'mike') to the ERD shape, keeping rows:
// - the old text id lives on as `slug` (unique); the frontend still identifies trainers by it,
// - a new bigint auto-increment `id` becomes the PK (what users / user_trainings reference),
// - name / path_to_image become varchar, path_to_image and tov become nullable,
// - created_at / updated_at are added.
// Existing rows get ids ordered by sort_order, so every environment ends up with the same ids (Mike = 1, ...).
export async function up(db: Knex): Promise<void> {
  await db.raw("ALTER TABLE trainers DROP CONSTRAINT trainers_pkey");
  await db.raw("ALTER TABLE trainers RENAME COLUMN id TO slug");
  await db.raw("ALTER TABLE trainers ADD CONSTRAINT trainers_slug_unique UNIQUE (slug)");

  await db.raw("ALTER TABLE trainers ADD COLUMN id bigserial");
  await db.raw(`
    UPDATE trainers t SET id = o.rn
    FROM (SELECT slug, row_number() OVER (ORDER BY sort_order, slug) AS rn FROM trainers) o
    WHERE t.slug = o.slug
  `);
  await db.raw("SELECT setval(pg_get_serial_sequence('trainers', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM trainers");
  await db.raw("ALTER TABLE trainers ADD CONSTRAINT trainers_pkey PRIMARY KEY (id)");

  await db.schema.alterTable("trainers", (t) => {
    t.string("name").notNullable().alter();
    t.string("path_to_image").nullable().alter();
    t.text("tov").nullable().alter(); // trainer's tone of voice (TOV) for LLM prompts
    t.timestamps(true, true);
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.alterTable("trainers", (t) => {
    t.dropTimestamps();
  });
  // The 20261121 shape had these NOT NULL.
  await db("trainers").whereNull("path_to_image").update({ path_to_image: "" });
  await db("trainers").whereNull("tov").update({ tov: "" });
  await db.schema.alterTable("trainers", (t) => {
    t.text("name").notNullable().alter();
    t.text("path_to_image").notNullable().alter();
    t.text("tov").notNullable().alter();
  });

  await db.raw("ALTER TABLE trainers DROP COLUMN id"); // drops trainers_pkey and the owned sequence with it
  await db.raw("ALTER TABLE trainers DROP CONSTRAINT trainers_slug_unique");
  await db.raw("ALTER TABLE trainers RENAME COLUMN slug TO id");
  await db.raw("ALTER TABLE trainers ADD CONSTRAINT trainers_pkey PRIMARY KEY (id)");
}
