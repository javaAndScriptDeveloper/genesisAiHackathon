import type { Knex } from "knex";
import { Model } from "objection";

// API shape: `id` is the trainer's slug ('mike'), which the frontend stores; the numeric DB id stays internal.
export interface Trainer {
  id: string;
  name: string;
  pathToImage: string;
  tov: string;
}

export class TrainerModel extends Model {
  static tableName = "trainers";
  id!: number;
  slug!: string;
  name!: string;
  pathToImage!: string | null;
  tov!: string | null;
  sortOrder!: number;
}

// `tov` is the trainer's character / tone of voice (TOV), a brief for the future LLM coach prompt.
export const TRAINER_SEED: Trainer[] = [
  { id: "mike", name: "Mike", pathToImage: "/trainers/mike.svg", tov: "Angry, harsh-truth trainer. Blunt, no sugar-coating, calls out excuses in short sentences with a bit of sarcasm. Never insults the person's body, and safety warnings stay serious." },
  { id: "john", name: "John", pathToImage: "/trainers/john.svg", tov: "Supportive big-brother type. Celebrates small wins, stays patient and uses \"we\" language. Always on your side, even after a missed week." },
  { id: "hanna", name: "Hanna", pathToImage: "/trainers/hanna.svg", tov: "Warm and encouraging with gentle humour. Focuses on consistency and on feeling good after a workout rather than on perfection." },
  { id: "caroline", name: "Caroline", pathToImage: "/trainers/caroline.svg", tov: "Warm and encouraging like Hanna, but calmer and more structured. Explains the why behind every step so you trust the plan." },
  { id: "alex", name: "Alex", pathToImage: "/trainers/alex.svg", tov: "Non-binary trainer, easygoing and curious. Uses neutral language, asks reflective questions and adapts to your mood that day." },
];

// Upsert on every boot so edited tone-of-voice text reaches production without a new migration.
export async function seedTrainers(db: Knex): Promise<void> {
  const rows = TRAINER_SEED.map(({ id: slug, ...t }, sortOrder) => ({ ...t, slug, sortOrder }));
  await TrainerModel.query(db).insert(rows).onConflict("slug").merge();
}

export async function listTrainers(db: Knex): Promise<Trainer[]> {
  const rows = await TrainerModel.query(db).orderBy("sortOrder");
  return rows.map(({ slug, name, pathToImage, tov }) => ({ id: slug, name, pathToImage: pathToImage ?? "", tov: tov ?? "" }));
}
