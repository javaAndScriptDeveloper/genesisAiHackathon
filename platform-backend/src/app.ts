import Fastify, { type FastifyInstance } from "fastify";
import type { Knex } from "knex";
import { listTrainers } from "./trainers.js";
import { progressRoutes } from "./progress/routes.js";
import { usersRoutes } from "./users.js";

export function buildApp(db: Knex): FastifyInstance {
  const app = Fastify({
    logger: true,
    // Strict body validation: reject unknown properties and wrong types instead of stripping/coercing them.
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } },
  });

  app.get("/api/health", async (_req, reply) => {
    try {
      await db.raw("SELECT 1");
      return { status: "ok", db: true };
    } catch (err) {
      app.log.error(err, "database health check failed");
      return reply.code(503).send({ status: "error", db: false });
    }
  });

  // Dummy route: lets the frontend prove service-to-service calls work after every deploy.
  app.get("/api/ping", async () => ({
    message: "pong from platform-backend",
    time: new Date().toISOString(),
  }));

  app.get("/api/trainers", async (_req, reply) => {
    try {
      return { trainers: await listTrainers(db) };
    } catch (err) {
      app.log.error(err, "listing trainers failed");
      return reply.code(503).send({ error: "trainers unavailable" });
    }
  });

  app.register(progressRoutes(db));
  app.register(usersRoutes(db));

  return app;
}
