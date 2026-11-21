import path from "node:path";
import knex, { type Knex } from "knex";
import pg from "pg";
import { knexSnakeCaseMappers } from "objection";

// numeric (OID 1700) -> JS number, so weights and kg come back as numbers, not strings.
pg.types.setTypeParser(1700, parseFloat);

export function createDb(connectionString: string): Knex {
  return knex({ client: "pg", connection: connectionString, pool: { min: 0, max: 5 }, ...knexSnakeCaseMappers() });
}

// Works from dist/ (compiled .js) in Docker and from src/ (.ts) under Vitest.
export const migrationConfig: Knex.MigratorConfig = {
  directory: path.join(import.meta.dirname, "migrations"),
  loadExtensions: [".js", ".ts"],
};

export async function migrate(db: Knex): Promise<void> {
  await db.migrate.latest(migrationConfig);
}
