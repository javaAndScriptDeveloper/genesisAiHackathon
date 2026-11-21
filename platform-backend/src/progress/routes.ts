import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Knex } from "knex";
import { archiveSnapshot, getSnapshot, HttpError, listArchive, listWorkouts, markEventsSeen, resolveUser, syncSnapshot, type ArchiveInput, type HistoryQuery, type SyncBody } from "./repo.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = { type: "string", minLength: 1, maxLength: 128 } as const;
const date = { type: "string", format: "date" } as const;
const dateTime = { type: "string", format: "date-time" } as const;
const nullable = <T extends object>(schema: T) => ({ anyOf: [schema, { type: "null" }] });
const int = (min: number, max: number) => ({ type: "integer", minimum: min, maximum: max }) as const;

const setSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "exerciseId", "kind", "completed", "performedAt"],
  properties: {
    id: str,
    exerciseId: str,
    kind: { enum: ["weighted", "bodyweight", "timed"] },
    reps: nullable(int(0, 32767)),
    weightKg: nullable({ type: "number", minimum: 0, maximum: 9999 }),
    durationSec: nullable(int(0, 2147483647)),
    completed: { type: "boolean" },
    performedAt: dateTime,
  },
} as const;

const syncSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    settings: {
      type: "object",
      additionalProperties: false,
      properties: { weeklyGoal: int(2, 5), units: { enum: ["metric", "imperial"] }, heightCm: nullable({ type: "number", minimum: 0, maximum: 300 }) },
    },
    planDays: {
      type: "array",
      maxItems: 2000,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "type"],
        properties: { date, type: { enum: ["training", "rest"] }, workoutRef: nullable(str) },
      },
    },
    workouts: {
      type: "array",
      maxItems: 2000,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "performedOn", "status", "plannedSets", "durationSec", "adapted", "adHoc", "sets"],
        properties: {
          id: str,
          trainingId: nullable(int(1, Number.MAX_SAFE_INTEGER)),
          planDate: nullable(date),
          performedOn: date,
          status: { enum: ["completed", "partial", "abandoned"] },
          plannedSets: int(0, 32767),
          durationSec: int(0, 2147483647),
          perceived: nullable(str),
          adapted: { type: "boolean" },
          adHoc: { type: "boolean" },
          sets: { type: "array", maxItems: 500, items: setSchema },
        },
      },
    },
    pauses: {
      type: "array",
      maxItems: 500,
      items: { type: "object", additionalProperties: false, required: ["id", "fromDate", "toDate"], properties: { id: str, fromDate: date, toDate: date } },
    },
    weights: {
      type: "array",
      maxItems: 5000,
      items: { type: "object", additionalProperties: false, required: ["date", "kg"], properties: { date, kg: { type: "number", exclusiveMinimum: 0, maximum: 999.99 } } },
    },
    events: {
      type: "array",
      maxItems: 2000,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kind", "refId", "createdAt"],
        properties: { id: str, kind: { enum: ["badge", "level", "pr", "report"] }, refId: str, payload: {}, createdAt: dateTime, seenAt: nullable(dateTime) },
      },
    },
  },
} as const;

const seenSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ids", "seenAt"],
  properties: { ids: { type: "array", maxItems: 1000, items: str }, seenAt: dateTime },
} as const;

const archiveSchema = {
  type: "object",
  additionalProperties: false,
  required: ["period", "weekStart", "takenAt", "engineVersion", "payload", "payloadHash"],
  properties: {
    period: { enum: ["weekly", "change"] },
    weekStart: nullable(date),
    takenAt: dateTime,
    engineVersion: str,
    payload: { type: "object" },
    payloadHash: str,
  },
} as const;

const archiveQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: { from: date, to: date, period: { enum: ["weekly", "change"] } },
} as const;

const historyQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    from: date,
    to: date,
    status: { enum: ["completed", "partial", "abandoned"] },
    limit: { type: "string", pattern: "^[1-9][0-9]{0,2}$" }, // query strings are not coerced (src/app.ts); 1..200 checked in the handler
    cursor: { type: "string", minLength: 1, maxLength: 512, pattern: "^[A-Za-z0-9_-]+$" },
  },
} as const;

const isMonday = (d: string): boolean => new Date(`${d}T00:00:00Z`).getUTCDay() === 1;

function token(req: FastifyRequest): string {
  return (req.headers["x-progress-token"] as string).toLowerCase();
}

export function progressRoutes(db: Knex) {
  return async (app: FastifyInstance): Promise<void> => {
    // onRequest runs before body validation, so a bad token is always a 400 about the token.
    app.addHook("onRequest", async (req, reply) => {
      const header = req.headers["x-progress-token"];
      if (typeof header !== "string" || !UUID.test(header)) return reply.code(400).send({ error: "invalid progress token" });
    });

    const guard = async (reply: FastifyReply, label: string, fn: () => Promise<unknown>, okCode = 200) => {
      try {
        return reply.code(okCode).send(await fn());
      } catch (err) {
        if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: err.message });
        const code = (err as { code?: string }).code;
        if (code === "23514") return reply.code(400).send({ error: "value violates a constraint" });
        if (code === "23505") return reply.code(409).send({ error: "conflicting record" });
        app.log.error(err, `${label} failed`);
        return reply.code(503).send({ error: "progress unavailable" });
      }
    };

    app.get("/api/progress/snapshot", async (req, reply) =>
      guard(reply, "progress snapshot", async () => getSnapshot(db, await resolveUser(db, token(req), { create: false }))));

    app.post("/api/progress/sync", { bodyLimit: 1024 * 1024, schema: { body: syncSchema } }, async (req, reply) =>
      guard(reply, "progress sync", async () => {
        const userId = await resolveUser(db, token(req), { create: true });
        return syncSnapshot(db, userId!, req.body as SyncBody);
      }));

    app.post("/api/progress/events/seen", { schema: { body: seenSchema } }, async (req, reply) =>
      guard(reply, "progress events seen", async () => {
        const { ids, seenAt } = req.body as { ids: string[]; seenAt: string };
        return { updated: await markEventsSeen(db, await resolveUser(db, token(req), { create: false }), ids, seenAt) };
      }));

    app.post("/api/progress/archive", { bodyLimit: 1024 * 1024, schema: { body: archiveSchema } }, async (req, reply) => {
      const body = req.body as ArchiveInput;
      if (body.period === "weekly" && (body.weekStart === null || !isMonday(body.weekStart))) return reply.code(400).send({ error: "weekly archive needs a Monday weekStart" });
      if (body.period === "change" && body.weekStart !== null) return reply.code(400).send({ error: "change archive must have null weekStart" });
      try {
        const userId = await resolveUser(db, token(req), { create: true });
        const archived = await archiveSnapshot(db, userId!, body);
        return reply.code(archived ? 201 : 200).send({ archived });
      } catch (err) {
        app.log.error(err, "progress archive failed");
        return reply.code(503).send({ error: "progress unavailable" });
      }
    });

    app.get("/api/progress/workouts", { schema: { querystring: historyQuerySchema } }, async (req, reply) => {
      const { limit, ...rest } = req.query as Omit<HistoryQuery, "limit"> & { limit?: string };
      const n = limit === undefined ? undefined : Number(limit);
      if (n !== undefined && n > 200) return reply.code(400).send({ error: "limit must be between 1 and 200" });
      return guard(reply, "progress workout history", async () => listWorkouts(db, await resolveUser(db, token(req), { create: false }), { ...rest, limit: n }));
    });

    app.get("/api/progress/archive", { schema: { querystring: archiveQuerySchema } }, async (req, reply) =>
      guard(reply, "progress archive list", async () => ({
        snapshots: await listArchive(db, await resolveUser(db, token(req), { create: false }), req.query as { from?: string; to?: string; period?: "weekly" | "change" }),
      })));
  };
}
