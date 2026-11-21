import type { Knex } from "knex";

// Answers from the onboarding flow (goal, days per week, injuries, ...), stored as-is.
export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("users", (t) => {
    t.jsonb("onboarding").nullable();
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.alterTable("users", (t) => {
    t.dropColumn("onboarding");
  });
}
