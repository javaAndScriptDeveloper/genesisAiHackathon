import type { Knex } from "knex";
import { Model } from "objection";

export interface Trainer {
  id: string;
  name: string;
  iconPath: string;
  description: string;
}

export class TrainerModel extends Model {
  static tableName = "trainers";
  id!: string;
  name!: string;
  iconPath!: string;
  description!: string;
  sortOrder!: number;
}

// `description` is the trainer's character / tone of voice, a brief for the future LLM coach prompt.
export const TRAINER_SEED: Trainer[] = [
  { id: "mike", name: "Mike", iconPath: "/trainers/mike.svg", description: "Angry, harsh-truth trainer. Blunt, no sugar-coating, calls out excuses in short sentences with a bit of sarcasm. Never insults the person's body, and safety warnings stay serious." },
  { id: "john", name: "John", iconPath: "/trainers/john.svg", description: "Supportive big-brother type. Celebrates small wins, stays patient and uses \"we\" language. Always on your side, even after a missed week." },
  { id: "hanna", name: "Hanna", iconPath: "/trainers/hanna.svg", description: "Warm and encouraging with gentle humour. Focuses on consistency and on feeling good after a workout rather than on perfection." },
  { id: "caroline", name: "Caroline", iconPath: "/trainers/caroline.svg", description: "Warm and encouraging like Hanna, but calmer and more structured. Explains the why behind every step so you trust the plan." },
  { id: "alex", name: "Alex", iconPath: "/trainers/alex.svg", description: "Non-binary trainer, easygoing and curious. Uses neutral language, asks reflective questions and adapts to your mood that day." },
];

// Upsert on every boot so edited tone-of-voice text reaches production without a new migration.
export async function seedTrainers(db: Knex): Promise<void> {
  const rows = TRAINER_SEED.map((t, sortOrder) => ({ ...t, sortOrder }));
  await TrainerModel.query(db).insert(rows).onConflict("id").merge();
}

export async function listTrainers(db: Knex): Promise<Trainer[]> {
  const rows = await TrainerModel.query(db).orderBy("sortOrder");
  return rows.map(({ id, name, iconPath, description }) => ({ id, name, iconPath, description }));
}
