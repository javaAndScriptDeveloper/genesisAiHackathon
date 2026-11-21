import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Knex } from "knex";
import { generateDailyStats, type DailyStats, type Scenario } from "./demoStats.js";
import { HttpError, resolveUser, withGuestUser } from "./progress/repo.js";

// Routes for the AI training plans, scoped to the device's progress token (x-progress-token), like /api/progress.
// users.id stays internal: it seeds the demo statistics but is never returned.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Params and query strings are not coerced (src/app.ts), so numeric ones are validated as digit strings.
const idParam = { type: "string", pattern: "^[1-9][0-9]{0,15}$" } as const;

const createDeviceSchema = {
  body: {
    type: "object",
    required: ["title"],
    additionalProperties: false,
    properties: { title: { type: "string", minLength: 1, maxLength: 100 } },
  },
} as const;

const syncSchema = {
  params: { type: "object", required: ["deviceId"], properties: { deviceId: idParam } },
  body: {
    type: "object",
    required: ["date"],
    additionalProperties: false,
    properties: {
      date: { type: "string", format: "date" },
      scenario: { enum: ["normal", "tired", "bad-night"] },
    },
  },
} as const;

const snapshotsSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: { days: { type: "string", pattern: "^[1-9][0-9]?$" } }, // 1..31 checked in the handler
  },
} as const;

const createTrainingSchema = {
  body: {
    type: "object",
    required: ["trainerSlug", "planData"],
    additionalProperties: false,
    properties: { trainerSlug: { type: ["string", "null"], maxLength: 64 }, planData: { type: "object" } },
  },
} as const;

// Pure calendar arithmetic on YYYY-MM-DD (UTC, so no DST/timezone drift).
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const token = (req: FastifyRequest): string => (req.headers["x-progress-token"] as string).toLowerCase();

export function meRoutes(db: Knex) {
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
        app.log.error(err, `${label} failed`);
        return reply.code(503).send({ error: "storage unavailable" });
      }
    };

    app.post<{ Body: { title: string } }>("/api/me/devices", { schema: createDeviceSchema }, async (req, reply) =>
      guard(
        reply,
        "creating device",
        () =>
          withGuestUser(db, token(req), async (trx, userId) => {
            const [row] = await trx("user_devices").insert({ userId, title: req.body.title }).returning("id");
            return { id: Number(row.id) };
          }),
        201,
      ));

    app.post<{ Params: { deviceId: string }; Body: { date: string; scenario?: Scenario } }>(
      "/api/me/devices/:deviceId/sync",
      { schema: syncSchema },
      async (req, reply) =>
        guard(reply, "device sync", () =>
          // A missing device throws inside the transaction, so a guest created for it is rolled back too.
          withGuestUser(db, token(req), async (trx, userId) => {
            const deviceId = Number(req.params.deviceId);
            const { date, scenario } = req.body;
            const device = await trx("user_devices").where({ id: deviceId, userId }).first("id");
            if (!device) throw new HttpError(404, "device not found");

            // A sync without a scenario is idempotent for a date that already has data: it never overwrites a
            // simulated night with a "normal" one. An explicit scenario always appends (latest row per date wins).
            const previous = Array.from({ length: 6 }, (_, i) => shiftDate(date, i - 6));
            const have = await trx("user_device_data_snapshots")
              .where({ userId, deviceId })
              .whereRaw("data->>'date' = any(?)", [previous])
              .select(trx.raw("data->>'date' as date"));
            const existing = new Set(have.map((r: { date: string }) => r.date));
            const rows = previous
              .filter((d) => !existing.has(d))
              .map((d) => ({ userId, deviceId, data: JSON.stringify(generateDailyStats(userId, d, "normal")) }));
            const current: { data: DailyStats } | undefined = scenario
              ? undefined
              : await trx("user_device_data_snapshots")
                  .where({ userId, deviceId })
                  .whereRaw("data->>'date' = ?", [date])
                  .orderBy("id", "desc")
                  .first("data");
            const snapshot = current?.data ?? generateDailyStats(userId, date, scenario ?? "normal");
            if (!current) rows.push({ userId, deviceId, data: JSON.stringify(snapshot) });
            if (rows.length > 0) await trx("user_device_data_snapshots").insert(rows);
            return { snapshot };
          }),
        ),
    );

    app.get<{ Querystring: { days?: string } }>("/api/me/snapshots", { schema: snapshotsSchema }, async (req, reply) => {
      const days = req.query.days === undefined ? 7 : Number(req.query.days);
      if (days > 31) return reply.code(400).send({ error: "days must be between 1 and 31" });
      return guard(reply, "listing snapshots", async () => {
        const userId = await resolveUser(db, token(req), { create: false });
        if (userId === null) return { snapshots: [] };
        const newest = await db("user_device_data_snapshots").where({ userId }).max({ d: db.raw("data->>'date'") }).first();
        if (!newest?.d) return { snapshots: [] };
        const from = shiftDate(newest.d as string, -(days - 1));
        const result = await db.raw(
          `select data from (
             select distinct on (data->>'date') data, data->>'date' as d
             from user_device_data_snapshots
             where user_id = ? and data->>'date' >= ? and data->>'date' <= ?
             order by data->>'date', id desc
           ) t order by d asc`,
          [userId, from, newest.d],
        );
        return { snapshots: result.rows.map((r: { data: DailyStats }) => r.data) };
      });
    });

    app.post<{ Body: { trainerSlug: string | null; planData: object } }>("/api/me/trainings", { schema: createTrainingSchema }, async (req, reply) =>
      guard(
        reply,
        "saving training",
        () =>
          withGuestUser(db, token(req), async (trx, userId) => {
            const { trainerSlug, planData } = req.body;
            const trainer = trainerSlug === null ? undefined : await trx("trainers").where({ slug: trainerSlug }).first("id");
            const [row] = await trx("user_trainings")
              .insert({ userId, trainerId: trainer?.id ?? null, planData: JSON.stringify(planData) })
              .returning("id");
            return { id: Number(row.id) };
          }),
        201,
      ));

    app.get("/api/me/trainings/latest", async (req, reply) =>
      guard(reply, "latest training", async () => {
        const userId = await resolveUser(db, token(req), { create: false });
        if (userId === null) return { training: null };
        const row = await db("user_trainings as ut")
          .leftJoin("trainers as t", "t.id", "ut.trainerId")
          .where("ut.userId", userId)
          .orderBy([
            { column: "ut.createdAt", order: "desc" },
            { column: "ut.id", order: "desc" },
          ])
          .first("ut.id", "ut.planData", "ut.createdAt", "t.slug as trainerSlug");
        if (!row) return { training: null };
        return {
          training: {
            id: Number(row.id),
            trainerSlug: row.trainerSlug ?? null,
            planData: row.planData,
            createdAt: new Date(row.createdAt).toISOString(),
          },
        };
      }));
  };
}
