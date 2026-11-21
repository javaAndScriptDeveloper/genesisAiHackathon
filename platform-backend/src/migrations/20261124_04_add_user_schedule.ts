import type { Knex } from "knex";

// The onboarding "Days" step: how many days a week the user trains and how long one session is.
// A new migration (not an edit of 20261123_02_create_users) so databases that already created `users` get the columns.
export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("users", (t) => {
    t.smallint("days_per_week").nullable(); // 1–7
    t.smallint("duration_min").nullable(); // minutes per session
    t.check("days_per_week between 1 and 7", [], "users_days_per_week_check");
    t.check("duration_min > 0", [], "users_duration_min_check");
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.alterTable("users", (t) => {
    t.dropChecks(["users_days_per_week_check", "users_duration_min_check"]);
    t.dropColumns("days_per_week", "duration_min");
  });
}
