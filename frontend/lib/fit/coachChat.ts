import type { CoachRequest } from "./aiApi";
import type { ProfileChanges } from "./aiPlan";
import { isSafetyConcern } from "./coach";
import { findExercise } from "./exercises";
import type { ISODate } from "./dates";
import type { CoachAction, CoachMessage, PlannedWorkout, Profile } from "./types";

export type ChangeField = keyof ProfileChanges;
export type ChangeValue = string | number | string[];
export interface ProfileChange {
	field: ChangeField;
	from: ChangeValue;
	to: ChangeValue;
}

const FIELDS: ChangeField[] = ["location", "equipment", "limitations", "limitationNote", "daysPerWeek", "durationMin", "goal"];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Applies the AI's partial changes on top of the current profile. */
export function mergeProfile(profile: Profile, changes: ProfileChanges | null): Profile {
	if (!changes) return profile;
	// A new preset goal makes the old free-text wording stale.
	const goalText = changes.goal !== undefined && changes.goal !== profile.goal ? undefined : profile.goalText;
	return { ...profile, ...changes, goalText };
}

/** Only the settings that really differ from the current profile. */
export function profileDiff(profile: Profile, changes: ProfileChanges | null): ProfileChange[] {
	if (!changes) return [];
	const out: ProfileChange[] = [];
	for (const field of FIELDS) {
		const to = changes[field];
		if (to !== undefined && !same(to, profile[field])) out.push({ field, from: profile[field], to });
	}
	return out;
}

/** Next 7 days of planned sessions, one line each, capped to the API limit. */
export function planSummaryText(planned: PlannedWorkout[], today: ISODate): string {
	const end = new Date(`${today}T00:00:00Z`);
	end.setUTCDate(end.getUTCDate() + 7);
	const limit = end.toISOString().slice(0, 10);
	return planned
		.filter((w) => w.status === "planned" && w.date >= today && w.date < limit)
		.sort((a, b) => a.date.localeCompare(b.date))
		.map((w) => `${w.date} ${w.title}: ${w.exercises.map((b) => findExercise(b.exerciseId)?.name ?? b.exerciseId).join(", ")}`)
		.join("\n")
		.slice(0, 4000);
}

/**
 * The last 12 messages for the AI, ending with the user's turn. Symptom messages and safety replies never reach
 * the AI; when the last message is not an allowed user message, the result is empty and the caller answers locally.
 */
export function chatHistory(messages: CoachMessage[]): CoachRequest["messages"] {
	const allowed = (m: CoachMessage) => !m.safety && !(m.from === "user" && isSafetyConcern(m.text));
	const last = messages[messages.length - 1];
	if (!last || last.from !== "user" || !allowed(last)) return [];
	const safe = messages.filter(allowed);
	return safe.slice(-12).map((m) => ({ from: m.from, text: m.text.slice(0, 600) }));
}

/** The profile after a regex-coach action that changes settings, or null when the action does not. */
export function profileAfterAction(profile: Profile, action: CoachAction): Profile | null {
	if (action.type === "remove-equipment") return { ...profile, equipment: profile.equipment.filter((e) => e !== action.equipment), location: profile.location === "gym" ? "hybrid" : profile.location };
	if (action.type === "avoid-limitation") return { ...profile, limitations: Array.from(new Set([...profile.limitations, action.limitation])) };
	return null;
}
