import pg from "pg";
import { buildApp } from "./app.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
// An idle-client error (e.g. DB restart) must not crash the process.
pool.on("error", (err) => console.error("pg pool error", err));

const app = buildApp(pool);

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
