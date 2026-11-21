import { findExercise } from "./exercises";
import type { ExerciseKind } from "./types";

// Rough energy estimate from MET values (strength ~5, bodyweight ~4.5, cardio ~8, mobility ~2.5).
// kcal = MET x body weight (kg) x hours. Good for "about 150 kcal" labels, not for nutrition tracking.
const MET: Record<ExerciseKind, number> = { strength: 5, bodyweight: 4.5, cardio: 8, mobility: 2.5 };

export function kcalFor(exerciseIds: string[], weightKg: number, minutes: number): number {
	const mets = exerciseIds.map((id) => MET[findExercise(id)?.kind ?? "bodyweight"]);
	const met = mets.length ? mets.reduce((a, b) => a + b, 0) / mets.length : MET.bodyweight;
	return Math.max(0, Math.round(met * weightKg * (minutes / 60)));
}
