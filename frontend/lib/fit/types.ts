import type { NudgeFacts, NudgeKind } from "./nudge";
import type { ISODate } from "./dates";
import type { ArchiveItem, ProgressEvent } from "../progress/types";
import type { Units } from "./units";

export type Goal = "lose-fat" | "build-muscle" | "get-stronger" | "stay-fit" | "endurance";
export type Experience = "beginner" | "intermediate" | "advanced";
export type TrainingLocation = "home" | "gym" | "hybrid";
export type Equipment = "dumbbells" | "bench" | "barbell" | "machines" | "bands" | "jump-rope";
export type Limitation = "knees" | "lower-back" | "shoulders" | "wrists" | "heart-bp";
export type Gender = "female" | "male" | "non-binary" | "private";
export type WearableChoice = "none" | "apple" | "garmin";
export type Muscle = "chest" | "back" | "legs" | "glutes" | "shoulders" | "arms" | "core" | "cardio" | "mobility";
export type ExerciseKind = "strength" | "bodyweight" | "cardio" | "mobility";
export type Tier = "free" | "premium";

export interface Profile {
	name: string;
	age: number;
	gender: Gender | null;
	heightCm: number;
	weightKg: number;
	goal: Goal;
	/** The user's own wording of their goal (typed or dictated); `goal` is its closest preset. */
	goalText?: string;
	experience: Experience;
	location: TrainingLocation;
	equipment: Equipment[];
	durationMin: number;
	daysPerWeek: number;
	limitations: Limitation[];
	limitationNote: string;
	wearable: WearableChoice;
}

export interface Exercise {
	id: string;
	name: string;
	kind: ExerciseKind;
	muscle: Muscle;
	/** Every listed item must be available. Empty means no equipment. */
	equipment: Equipment[];
	level: 1 | 2 | 3;
	/** Performed for time (seconds) instead of repetitions. */
	timed?: boolean;
	/** Starting load as a fraction of body weight (kg per hand for dumbbells, total for bar/machines). */
	loadFactor?: number;
	/** Limitations this movement can aggravate; excluded when the user reports them. */
	stresses: Limitation[];
	summary: string;
	steps: string[];
	tips: string[];
	breathing: string;
	mistakes: string[];
	easierId?: string;
	harderId?: string;
}

export interface SetEntry {
	/** Target repetitions, or seconds for timed exercises. */
	target: number;
	targetWeight?: number;
	reps?: number;
	weight?: number;
	done: boolean;
}

export interface ExerciseBlock {
	id: string;
	exerciseId: string;
	restSec: number;
	sets: SetEntry[];
	skipped?: boolean;
	note?: string;
}

export type SkipReason = "recovery" | "busy" | "unwell";
export type PlannedStatus = "planned" | "completed" | "partial" | "skipped";

export interface PlannedWorkout {
	id: string;
	date: ISODate;
	title: string;
	focus: string;
	durationMin: number;
	difficulty: 1 | 2 | 3 | 4 | 5;
	exercises: ExerciseBlock[];
	status: PlannedStatus;
	skipReason?: SkipReason;
	movedFrom?: ISODate;
	/** Extra session outside the weekly plan: earns XP, never streak credit. */
	adHoc?: boolean;
	logId?: string;
	partnerId?: string;
}

export type Perceived = "easy" | "right" | "hard";

export interface LoggedExercise {
	exerciseId: string;
	skipped: boolean;
	sets: { reps: number; weight?: number }[];
}

export interface SessionLog {
	id: string;
	plannedId: string | null;
	date: ISODate;
	title: string;
	durationSec: number;
	status: "completed" | "partial";
	exercises: LoggedExercise[];
	volumeKg: number;
	perceived: Perceived;
	adaptations: string[];
	avgHr?: number;
	hrDemo?: boolean;
	xp: number;
	prs: string[];
	demo?: boolean;
}

export interface ActiveSession {
	id: string;
	plannedId: string | null;
	title: string;
	startedAt: string;
	exercises: ExerciseBlock[];
	index: number;
	phase: "work" | "rest" | "summary";
	paused: boolean;
	elapsedSec: number;
	restLeft: number;
	restTotal: number;
	workLeft: number | null;
	adaptations: string[];
	safetyStop: boolean;
	hrSamples: number[];
	outcome: "completed" | "partial" | "empty" | null;
	perceived: Perceived | null;
}

export type NotificationKind = "workout" | "missed" | "achievement" | "weekly-goal" | "recovery" | "coach" | "weekly-summary" | "streak";

export interface AppNotification {
	id: string;
	kind: NotificationKind;
	title: string;
	body: string;
	createdAt: string;
	read: boolean;
	href?: string;
	/** Set on kinds the trainer writes in their own voice: what to ask Gemini. */
	nudge?: { kind: NudgeKind; facts: NudgeFacts };
	/** The trainer-voice text once Gemini has written it; the template `body` stays as the fallback. */
	aiText?: string;
	/** The trainer-voice request failed once; never ask again (also after a reload). */
	aiFailed?: boolean;
}

export interface NotificationSettings {
	enabled: Record<NotificationKind, boolean>;
	reminderTime: string;
	browserPush: boolean;
}

export interface CoachMessage {
	id: string;
	from: "user" | "coach";
	text: string;
	at: string;
	actions?: CoachAction[];
	/** Set once the user taps one of the actions, so it cannot be applied twice. */
	appliedAction?: string;
	safety?: boolean;
}

export type AdaptOp =
	| { kind: "easier" }
	| { kind: "too-hard" }
	| { kind: "harder" }
	| { kind: "more-rest" }
	| { kind: "tired" }
	| { kind: "shorten"; minutes: number }
	| { kind: "replace"; blockId: string };

export type CoachAction =
	| { id: string; label: string; type: "adapt"; op: AdaptOp }
	| { id: string; label: string; type: "recovery-day" }
	| { id: string; label: string; type: "remove-equipment"; equipment: Equipment }
	| { id: string; label: string; type: "avoid-limitation"; limitation: Limitation }
	| { id: string; label: string; type: "rebuild-plan"; premium: true }
	| { id: string; label: string; type: "go"; href: string };

export interface DeviceState {
	apple: boolean;
	garmin: boolean;
}

export interface Subscription {
	tier: Tier;
	trialEndsAt: string | null;
}

export interface BloodPressureEntry {
	id: string;
	at: string;
	systolic: number;
	diastolic: number;
}

export interface PhotoCheckIn {
	id: string;
	date: ISODate;
	dataUrl: string;
	weightKg?: number;
}

export interface PhotoInsight {
	id: string;
	analyzedAt: string;
	beforeDate: string;
	afterDate: string;
	/** Local photo ids (FitState.photos). Null on old insights; the photo may since have been deleted. */
	beforePhotoId: string | null;
	afterPhotoId: string | null;
	beforeWeightKg: number | null;
	afterWeightKg: number | null;
	model: string;
	engineVersion: string;
	suitable: boolean;
	result: { summary: string; observations: { area: string; text: string }[]; encouragement: string };
}

export interface ChatMessage {
	id: string;
	from: "me" | "buddy";
	text: string;
	/** Resized JPEG data URL of a shared photo. */
	photo?: string;
	at: string;
}

export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner";

export interface FitState {
	version: 1;
	units: Units;
	profile: Profile | null;
	/** Selected AI trainer id (from platform-backend `/api/trainers`); null means the default trainer. */
	trainerId: string | null;
	planned: PlannedWorkout[];
	history: SessionLog[];
	active: ActiveSession | null;
	notifications: AppNotification[];
	notificationSettings: NotificationSettings;
	coach: CoachMessage[];
	unlocked: Record<string, string>;
	water: Record<ISODate, number>;
	waterGoalMl: number;
	meals: Record<ISODate, MealSlot[]>;
	subscription: Subscription;
	devices: DeviceState;
	bloodPressure: BloodPressureEntry[];
	photos: PhotoCheckIn[];
	/** Text-only results of AI photo analyses. The photos themselves are never stored remotely. */
	photoInsights: PhotoInsight[];
	/** When the user agreed to send photos to the AI; null means ask every time. */
	photoAiConsentAt: string | null;
	/** `at` is the moment the entry was saved (absent on demo seed data). */
	bodyWeights: { date: ISODate; kg: number; at?: string }[];
	goalWeightKg: number | null;
	/** When the current goal weight was set. */
	goalSetAt?: string | null;
	partners: Record<string, "invited" | "accepted">;
	/** When each pending request was sent (ISO). Approval is derived from it, so it survives navigation and reloads. */
	partnerInvitedAt: Record<string, string>;
	/** Simulated chats with connected gym buddies, keyed by buddy id. */
	chats: Record<string, ChatMessage[]>;
	hasDemoHistory: boolean;
	celebrate: string[];
	/** Streak pauses (illness, holiday): whole weeks from a Monday, at most 4 weeks each, never overlapping. */
	pauses: Pause[];
	/** Anonymous id used to sync progress with the backend. */
	progressToken: string;
	/** Planned workouts per week the user commits to (2..5). */
	weeklyGoal: number;
	progressEvents: ProgressEvent[];
	/** Last day `sync` diffed the progress snapshot on (rollover badges/levels); null until the first sync. */
	lastProgressDay: ISODate | null;
	/** Mondays (ISO dates) whose weekly report is already archived. */
	archivedWeeks: string[];
	archiveQueue: ArchiveItem[];
}

export interface Pause {
	from: ISODate;
	to: ISODate;
}
