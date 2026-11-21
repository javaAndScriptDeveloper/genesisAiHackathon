import { getExercise } from "./exercises";
import type { ExerciseBlock } from "./types";

/** "3 × 10 · 20 kg" or "3 × 40 s". Targets of the first remaining set stand in for the block. */
export function describeBlock(block: ExerciseBlock): string {
	const exercise = getExercise(block.exerciseId);
	const first = block.sets[0];
	if (!first) return "";
	const unit = exercise.timed ? " s" : "";
	const weight = first.targetWeight ? ` · ${first.targetWeight} kg` : "";
	return `${block.sets.length} × ${first.target}${unit}${weight}`;
}

export function tabMemory<T extends string>() {
	const store = new Map<string, T>();
	return { get: (key: string, fallback: T): T => store.get(key) ?? fallback, set: (key: string, value: T) => void store.set(key, value) };
}
