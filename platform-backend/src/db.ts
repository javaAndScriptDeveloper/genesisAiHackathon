import path from "node:path";
import knex, { type Knex } from "knex";
import { knexSnakeCaseMappers } from "objection";

export function createDb(connectionString: string): Knex {
  return knex({ client: "pg", connection: connectionString, pool: { min: 0, max: 5 }, ...knexSnakeCaseMappers() });
}

// Works from dist/ (compiled .js) in Docker and from src/ (.ts) under Vitest.
export async function migrate(db: Knex): Promise<void> {
  await db.migrate.latest({
    directory: path.join(import.meta.dirname, "migrations"),
    loadExtensions: [".js", ".ts"],
  });
}
