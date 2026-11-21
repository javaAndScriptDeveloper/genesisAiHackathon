import { getExercise } from "./exercises";
import type { ExerciseBlock } from "./types";
import { fmtLoad, type Units } from "./units";

/** "3 × 10 · 20 kg" or "3 × 40 s". Targets of the first remaining set stand in for the block. */
export function describeBlock(block: ExerciseBlock, units: Units): string {
	const exercise = getExercise(block.exerciseId);
	const first = block.sets[0];
	if (!first) return "";
	const unit = exercise.timed ? " s" : "";
	const weight = first.targetWeight ? ` · ${fmtLoad(first.targetWeight, units)}` : "";
	return `${block.sets.length} × ${first.target}${unit}${weight}`;
}
