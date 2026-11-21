import type { FastifyInstance } from "fastify";
import type { Knex } from "knex";
import { resolveUser } from "./progress/repo.js";
import { TrainerModel } from "./trainers.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The rest of the onboarding answers (the AI plan's inputs), stored as-is in users.onboarding.
const onboardingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    goal: { enum: ["lose-fat", "build-muscle", "get-stronger", "stay-fit", "endurance"] },
    goalText: { type: "string", maxLength: 500 },
    equipment: { type: "array", maxItems: 10, uniqueItems: true, items: { enum: ["dumbbells", "bench", "barbell", "machines", "bands", "jump-rope"] } },
    location: { enum: ["home", "gym", "hybrid"] },
    limitations: { type: "array", maxItems: 10, uniqueItems: true, items: { enum: ["knees", "lower-back", "shoulders", "wrists", "heart-bp"] } },
    limitationNote: { type: "string", maxLength: 1000 },
    wearable: { enum: ["none", "apple", "garmin"] },
  },
} as const;

const bodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    gender: { enum: ["female", "male", "non-binary", "private"] },
    weightKg: { type: "number", exclusiveMinimum: 0, maximum: 999 },
    heightCm: { type: "number", exclusiveMinimum: 0, maximum: 300 },
    level: { enum: ["beginner", "intermediate", "advanced"] },
    trainerId: { type: "string", minLength: 1, maxLength: 64 },
    daysPerWeek: { type: "integer", minimum: 1, maximum: 7 },
    durationMin: { type: "integer", minimum: 1, maximum: 600 },
    onboarding: onboardingSchema,
  },
} as const;

interface UserBody {
  name: string;
  gender?: string;
  weightKg?: number;
  heightCm?: number;
  level?: string;
  trainerId?: string;
  daysPerWeek?: number;
  durationMin?: number;
  onboarding?: Record<string, unknown>;
}

// The browser has no login yet, so a user is the device's progress token: the same guest user that progress sync
// creates gets its real profile here. users.id stays internal and is never returned.
export function usersRoutes(db: Knex) {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: UserBody }>("/api/users", { schema: { body: bodySchema } }, async (req, reply) => {
      const header = req.headers["x-progress-token"];
      if (typeof header !== "string" || !UUID.test(header)) return reply.code(400).send({ error: "invalid progress token" });
      const token = header.toLowerCase();
      const b = req.body;
      try {
        let trainerRowId: number | null = null;
        if (b.trainerId !== undefined) {
          const trainer = await TrainerModel.query(db).findOne({ slug: b.trainerId });
          if (!trainer) return reply.code(400).send({ error: "unknown trainer" });
          trainerRowId = Number(trainer.id);
        }
        const existed = (await resolveUser(db, token, { create: false })) !== null;
        const userId = await resolveUser(db, token, { create: true });
        await db("users").where({ id: userId }).update({
          name: b.name,
          gender: b.gender ?? null,
          weight: b.weightKg ?? null,
          height: b.heightCm ?? null,
          level: b.level ?? null,
          trainerId: trainerRowId,
          daysPerWeek: b.daysPerWeek ?? null,
          durationMin: b.durationMin ?? null,
          onboarding: b.onboarding === undefined ? null : JSON.stringify(b.onboarding),
          updatedAt: db.fn.now(),
        });
        return reply.code(existed ? 200 : 201).send({
          user: { name: b.name, gender: b.gender ?? null, weightKg: b.weightKg ?? null, heightCm: b.heightCm ?? null, level: b.level ?? null, trainerId: b.trainerId ?? null, daysPerWeek: b.daysPerWeek ?? null, durationMin: b.durationMin ?? null },
        });
      } catch (err) {
        app.log.error(err, "saving user failed");
        return reply.code(503).send({ error: "users unavailable" });
      }
    });
  };
}
