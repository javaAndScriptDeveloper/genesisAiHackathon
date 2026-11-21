import type { ProgressSnapshot } from "./engine";
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
export interface CheckIn {
	id: string;
	kind: "weight" | "goal" | "photo";
	date: IsoDate;
	at: string;
	weightKg?: number;
	goalKg?: number;
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
	checkIns: CheckIn[];
	device: DeviceDemo | null;
}
export type DayStatus = "completed" | "adapted" | "missed" | "rest" | "planned" | "none";
export interface Pause {
	from: IsoDate;
	to: IsoDate;
}
export interface ProgressContext {
	weeklyGoal: number; // 2..5
	pauses: Pause[];
}

export interface ProgressEvent {
	id: string;
	kind: "badge" | "level" | "pr" | "report";
	refId: string;
	createdAt: string;
	seenAt: string | null;
}
export interface ArchiveItem {
	id: string;
	period: "weekly" | "change";
	weekStart: IsoDate | null;
	takenAt: string;
	engineVersion: string;
	payload: ProgressSnapshot;
	payloadHash: string;
}
