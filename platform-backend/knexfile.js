// Knex CLI config for running migrations by hand: `npm run migrate:latest`, `npm run migrate:rollback -- --all`.
// The app itself migrates on boot (src/db.ts) using the default knex_migrations table, same as here.
// Migrations are loaded as .ts straight from src/ (Node's built-in type stripping, Node >= 23.6), but recorded under
// their compiled .js names, because that is what the running app (dist/) writes to knex_migrations. Otherwise the
// CLI and the app would each see the other's entries as missing files ("migration directory is corrupt").
import fs from "node:fs";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required, e.g. DATABASE_URL=postgres://app:app@localhost:15432/app npm run migrate:latest");
}

const dir = path.join(import.meta.dirname, "src", "migrations");

export default {
  client: "pg",
  connection: process.env.DATABASE_URL,
  migrations: {
    migrationSource: {
      async getMigrations() {
        return fs.readdirSync(dir).filter((f) => f.endsWith(".ts")).sort();
      },
      getMigrationName: (file) => file.replace(/\.ts$/, ".js"),
      getMigration: (file) => import(path.join(dir, file)),
    },
  },
};
