import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Knex } from "knex";

const nullable = (type: string, extra: object = {}) => ({ type: [type, "null"], ...extra });

const userProperties = {
  name: { type: "string", minLength: 1, maxLength: 255 },
  gender: nullable("string", { maxLength: 255 }),
  dob: nullable("string", { pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  weightKg: nullable("number", { minimum: 0, maximum: 999 }),
  heightCm: nullable("number", { minimum: 0, maximum: 999 }),
  level: nullable("string", { maxLength: 255 }),
  trainerSlug: nullable("string"),
  onboarding: { type: "object" },
} as const;

const createUserSchema = {
  body: { type: "object", required: ["name"], additionalProperties: false, properties: userProperties },
};
const patchUserSchema = {
  params: { type: "object", properties: { id: { type: "integer", minimum: 1 } } },
  body: { type: "object", additionalProperties: false, properties: userProperties },
};
const createDeviceSchema = {
  params: { type: "object", properties: { id: { type: "integer", minimum: 1 } } },
  body: {
    type: "object",
    required: ["title"],
    additionalProperties: false,
    properties: { title: { type: "string", minLength: 1, maxLength: 100 } },
  },
};

interface UserBody {
  name?: string;
  gender?: string | null;
  dob?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  level?: string | null;
  trainerSlug?: string | null;
  onboarding?: object;
}

// Maps API fields to columns, only for fields present in the body. Unknown trainer slug -> null.
async function toColumns(db: Knex, body: UserBody): Promise<Record<string, unknown>> {
  const cols: Record<string, unknown> = {};
  for (const key of ["name", "gender", "dob", "level"] as const) {
    if (body[key] !== undefined) cols[key] = body[key];
  }
  if (body.weightKg !== undefined) cols.weight = body.weightKg;
  if (body.heightCm !== undefined) cols.height = body.heightCm;
  if (body.onboarding !== undefined) cols.onboarding = JSON.stringify(body.onboarding);
  if (body.trainerSlug !== undefined) {
    const trainer = body.trainerSlug === null ? undefined : await db("trainers").where({ slug: body.trainerSlug }).first("id");
    cols.trainerId = trainer?.id ?? null;
  }
  return cols;
}

export function registerUserRoutes(app: FastifyInstance, db: Knex): void {
  app.post<{ Body: UserBody }>("/api/users", { schema: createUserSchema }, async (req, reply) => {
    const email = `demo-${randomBytes(6).toString("hex")}@demo.local`;
    const [row] = await db("users")
      .insert({ ...(await toColumns(db, req.body)), email })
      .returning("id");
    return reply.code(201).send({ id: Number(row.id) });
  });

  app.patch<{ Params: { id: number }; Body: UserBody }>("/api/users/:id", { schema: patchUserSchema }, async (req, reply) => {
    const rows = await db("users")
      .where({ id: req.params.id })
      .update({ ...(await toColumns(db, req.body)), updatedAt: db.fn.now() })
      .returning("id");
    if (rows.length === 0) return reply.code(404).send({ error: "user not found" });
    return { id: Number(rows[0].id) };
  });

  app.post<{ Params: { id: number }; Body: { title: string } }>("/api/users/:id/devices", { schema: createDeviceSchema }, async (req, reply) => {
    const user = await db("users").where({ id: req.params.id }).first("id");
    if (!user) return reply.code(404).send({ error: "user not found" });
    const [row] = await db("user_devices").insert({ userId: req.params.id, title: req.body.title }).returning("id");
    return reply.code(201).send({ id: Number(row.id) });
  });
}
