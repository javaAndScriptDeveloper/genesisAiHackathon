import { Model } from "objection";

// Column names are mapped to camelCase by knexSnakeCaseMappers (src/db.ts). Dates (`date` columns) come back as JS Dates.
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
  date!: Date;
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
  planDate!: Date | null;
  performedOn!: Date;
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
  fromDate!: Date;
  toDate!: Date;
}

export class ProgressWeightModel extends Model {
  static tableName = "user_progress_weights";
  static idColumn = ["user_id", "date"];
  userId!: number;
  date!: Date;
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
  weekStart!: Date | null;
  takenAt!: Date;
  engineVersion!: string;
  payload!: unknown;
  payloadHash!: string;
}
