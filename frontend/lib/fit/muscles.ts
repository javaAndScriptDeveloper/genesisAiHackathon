import type { Muscle as BodyMuscle } from "react-body-highlighter";
import { getExercise } from "./exercises";
import type { ExerciseBlock, Muscle } from "./types";

export interface BodyHighlight {
	view: "anterior" | "posterior";
	parts: BodyMuscle[];
}

// Our coarse muscle groups -> the anatomical regions the body diagram can light up. Cardio and mobility have no diagram.
export const BODY_MAP: Record<Muscle, BodyHighlight | null> = {
	chest: { view: "anterior", parts: ["chest"] },
	back: { view: "posterior", parts: ["upper-back", "lower-back", "trapezius"] },
	legs: { view: "anterior", parts: ["quadriceps", "hamstring", "calves", "adductor"] },
	glutes: { view: "posterior", parts: ["gluteal"] },
	shoulders: { view: "anterior", parts: ["front-deltoids", "back-deltoids"] },
	arms: { view: "anterior", parts: ["biceps", "triceps", "forearm"] },
	core: { view: "anterior", parts: ["abs", "obliques"] },
	cardio: null,
	mobility: null,
};

/** Distinct muscle groups a workout trains, in order of appearance (cardio and mobility excluded). */
export function musclesOf(blocks: ExerciseBlock[]): Muscle[] {
	const out: Muscle[] = [];
	for (const b of blocks) {
		const m = getExercise(b.exerciseId).muscle;
		if (BODY_MAP[m] && !out.includes(m)) out.push(m);
	}
	return out;
}
