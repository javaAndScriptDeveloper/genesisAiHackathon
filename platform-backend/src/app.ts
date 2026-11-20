import Fastify, { type FastifyInstance } from "fastify";

export interface Queryable {
  query: (sql: string) => Promise<unknown>;
}

export function buildApp(pool: Queryable): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get("/api/health", async (_req, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok", db: true };
    } catch (err) {
      app.log.error(err, "database health check failed");
      return reply.code(503).send({ status: "error", db: false });
    }
  });

  return app;
}
