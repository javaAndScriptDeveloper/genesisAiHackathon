export type IsoDate = string; // YYYY-MM-DD
export type ExerciseKind = "weighted" | "bodyweight" | "timed";
export interface Exercise {
	id: string;
	name: string;
	kind: ExerciseKind;
}
export interface SetLog {
	exerciseId: string;
	reps: number;
	weightKg: number | null;
	durationSec: number | null;
}
export interface PlannedDay {
	date: IsoDate;
	type: "workout" | "rest";
}
export type Rpe = "easy" | "ok" | "hard";
export interface WorkoutSession {
	id: string;
	date: IsoDate;
	planned: boolean;
	status: "completed" | "abandoned";
	adapted: boolean;
	durationMin: number;
	setsPlanned: number;
	sets: SetLog[];
	rpe: Rpe | null;
}
export interface BodyMeasurement {
	date: IsoDate;
	weightKg: number;
}
export interface DeviceDemo {
	avgWorkoutHeartRate: number;
	avgDailySteps: number;
	avgSleepHours: number;
}
export interface History {
	today: IsoDate;
	exercises: Exercise[];
	plan: PlannedDay[];
	sessions: WorkoutSession[];
	body: BodyMeasurement[];
	device: DeviceDemo | null;
}
export type DayStatus = "completed" | "adapted" | "missed" | "rest" | "planned" | "none";
