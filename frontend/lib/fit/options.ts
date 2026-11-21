import type { Equipment, Experience, Gender, Goal, Limitation, TrainingLocation, WearableChoice } from "./types";

// Choice lists for onboarding and settings. Visible text lives in messages (fit.opt.<group>.<id>.label|hint).
export const GOALS: Goal[] = ["lose-fat", "build-muscle", "get-stronger", "stay-fit", "endurance"];
export const EXPERIENCES: Experience[] = ["beginner", "intermediate", "advanced"];
export const LOCATIONS: TrainingLocation[] = ["home", "gym", "hybrid"];
export const EQUIPMENT: Equipment[] = ["dumbbells", "bench", "barbell", "machines", "bands", "jump-rope"];
export const LIMITATIONS: Limitation[] = ["knees", "lower-back", "shoulders", "wrists", "heart-bp"];
export const GENDERS: Gender[] = ["female", "male", "non-binary", "private"];
export const WEARABLES: WearableChoice[] = ["none", "apple", "garmin"];
export const DURATIONS = [20, 30, 45, 60];
export const DAYS = [2, 3, 4, 5, 6];

export const DEFAULT_TRAINER_ID = "john";
export const activeTrainerId = (state: { trainerId: string | null }): string => state.trainerId ?? DEFAULT_TRAINER_ID;
