import { Model } from "objection";

// Column names are mapped to camelCase by knexSnakeCaseMappers (src/db.ts). `date` columns come back as 'YYYY-MM-DD' strings (parser in src/db.ts); timestamptz as JS Dates.
export class ProgressSettingsModel extends Model {
  static tableName = "user_progress_settings";
  static idColumn = "user_id";
  userId!: number;
  clientToken!: string;
  weeklyGoal!: number;
  units!: "metric" | "imperial";
  createdAt!: Date;
  updatedAt!: Date;
}

export class ProgressPlanDayModel extends Model {
  static tableName = "user_progress_plan_days";
  static idColumn = ["user_id", "date"];
  userId!: number;
  date!: string;
  type!: "training" | "rest";
  workoutRef!: string | null;
}

export class ProgressSetModel extends Model {
  static tableName = "user_progress_sets";
  id!: string;
  userId!: number;
  workoutId!: string;
  exerciseId!: string;
  kind!: "weighted" | "bodyweight" | "timed";
  reps!: number | null;
  weightKg!: number | null;
  durationSec!: number | null;
  completed!: boolean;
  performedAt!: Date;
}

export class ProgressWorkoutModel extends Model {
  static tableName = "user_progress_workouts";
  id!: string;
  userId!: number;
  trainingId!: number | null;
  planDate!: string | null;
  performedOn!: string;
  status!: "completed" | "partial" | "abandoned";
  plannedSets!: number;
  durationSec!: number;
  perceived!: string | null;
  adapted!: boolean;
  adHoc!: boolean;
  createdAt!: Date;
  sets?: ProgressSetModel[];

  static relationMappings = {
    sets: {
      relation: Model.HasManyRelation,
      modelClass: ProgressSetModel,
      join: { from: "user_progress_workouts.id", to: "user_progress_sets.workoutId" },
    },
  };
}

export class ProgressPauseModel extends Model {
  static tableName = "user_progress_pauses";
  id!: string;
  userId!: number;
  fromDate!: string;
  toDate!: string;
}

export class ProgressWeightModel extends Model {
  static tableName = "user_progress_weights";
  static idColumn = ["user_id", "date"];
  userId!: number;
  date!: string;
  kg!: number;
}

export class ProgressEventModel extends Model {
  static tableName = "user_progress_events";
  id!: string;
  userId!: number;
  kind!: "badge" | "level" | "pr" | "report";
  refId!: string;
  payload!: unknown;
  createdAt!: Date;
  seenAt!: Date | null;
}

// Archive: append-only. Repositories only insert; never call patch/update/delete on this model.
export class ProgressSnapshotModel extends Model {
  static tableName = "user_progress_snapshots";
  id!: number;
  userId!: number;
  period!: "weekly" | "change";
  weekStart!: string | null;
  takenAt!: Date;
  engineVersion!: string;
  payload!: unknown;
  payloadHash!: string;
}

// Check-in journal. Photos are metadata only (date + weight); an image is never stored.
export class ProgressCheckInModel extends Model {
  static tableName = "user_progress_checkins";
  id!: string;
  userId!: number;
  kind!: "weight" | "goal" | "photo";
  date!: string;
  takenAt!: Date;
  weightKg!: number | null;
  goalKg!: number | null;
  createdAt!: Date;
}

// AI photo-analysis results (text only); the compared photos are never stored.
export class ProgressPhotoInsightModel extends Model {
  static tableName = "user_progress_photo_insights";
  id!: string;
  userId!: number;
  analyzedAt!: Date;
  beforeDate!: string;
  afterDate!: string;
  beforePhotoId!: string | null;
  afterPhotoId!: string | null;
  beforeWeightKg!: number | null;
  afterWeightKg!: number | null;
  model!: string;
  engineVersion!: string;
  suitable!: boolean;
  result!: PhotoInsightResult;
  createdAt!: Date;
}

export interface PhotoInsightResult {
  summary: string;
  observations: { area: string; text: string }[];
  encouragement: string;
}
