import { statsSummary, type DailyStats, type DailyStatus } from "./dailyStats";
import { EXERCISES, isUsable } from "./exercises";
import type { ExerciseKind, Muscle, PlannedWorkout, Profile } from "./types";

export interface TrainerVoice {
	name: string;
	tov: string;
}

export function systemFor(trainer: TrainerVoice): string {
	return `You are ${trainer.name}, a personal fitness trainer. Tone of voice: ${trainer.tov}. Stay in this tone in every text you write. Never diagnose or give medical advice. Never encourage training through pain, dizziness or chest symptoms; tell the user to stop and rest, and see a professional if it persists. Keep replies short (2-4 sentences). Use only exercise ids from the provided list.`;
}

export function usableExerciseList(profile: Profile): { id: string; name: string; muscle: Muscle; kind: ExerciseKind; level: number; timed: boolean }[] {
	return EXERCISES.filter((e) => isUsable(e, profile)).map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, kind: e.kind, level: e.level, timed: Boolean(e.timed) }));
}

const profileJson = (profile: Profile) => JSON.stringify(profile);
const exerciseJson = (profile: Profile) => JSON.stringify(usableExerciseList(profile));

function wishLines(wishes: string[]): string {
	return wishes.length ? wishes.map((w) => `- ${w}`).join("\n") : "- none";
}

export function weekPrompt(i: { profile: Profile; stats: DailyStats[]; wishes: string[] }): string {
	const { profile } = i;
	const last = i.stats[i.stats.length - 1];
	const light = last && last.readiness < 60 ? "Recent readiness is below 60: make the first days lighter (fewer sets, easier exercises).\n" : "";
	return `Create one weekly training plan with exactly ${profile.daysPerWeek} sessions. Weekday 0 = Monday, 6 = Sunday; use distinct weekdays.
Each session should take about ${profile.durationMin} minutes. Leave rest days between hard days. Respect the user's limitations (${profile.limitations.join(", ") || "none"}; note: ${profile.limitationNote || "none"}) and these wishes:
${wishLines(i.wishes)}
${light}Each exercise needs exerciseId (from the list), sets, reps (or seconds for timed ones) and restSec. Reply with JSON: summary, sessions[{weekday,title,focus,exercises[]}].

Device data: ${statsSummary(i.stats)}
Profile: ${profileJson(profile)}
Usable exercises: ${exerciseJson(profile)}`;
}

export function dailyPrompt(i: { profile: Profile; stats: DailyStats; status: DailyStatus; session: PlannedWorkout | null }): string {
	const plan = i.session
		? JSON.stringify({ title: i.session.title, focus: i.session.focus, durationMin: i.session.durationMin, exercises: i.session.exercises.map((b) => ({ exerciseId: b.exerciseId, sets: b.sets.length, target: b.sets[0]?.target, restSec: b.restSec })) })
		: "none (rest day)";
	const rule = !i.session
		? "Today is a rest day: write one supportive line recommending rest or a gentle walk; don't propose a workout, and return an empty exercises list."
		: i.status === "recovery"
			? "Replace it with an active recovery session of at most 30 minutes: only mobility, cardio or core exercises, never more sets than planned."
			: i.status === "lighter"
				? "Make it lighter: fewer sets or easier exercises, never more sets or time than planned."
				: "Keep the session as planned.";
	return `Adjust today's session from the device data. Status: ${i.status}. ${rule}
Reply with JSON: note (one short sentence for the user), title, exercises[{exerciseId,sets,reps|seconds,restSec}].

Today's data: ${statsSummary([i.stats])}
Planned session: ${plan}
Profile: ${profileJson(i.profile)}
Usable exercises: ${exerciseJson(i.profile)}`;
}

export function coachPrompt(i: { profile: Profile; stats: DailyStats[]; wishes: string[]; planSummary: string; messages: { from: "user" | "coach"; text: string }[] }): string {
	const chat = i.messages.map((m) => `${m.from === "user" ? "User" : "Coach"}: ${m.text}`).join("\n");
	return `Reply to the user's last message as their trainer. Reply with JSON: reply (2-4 sentences), rebuild.
Set rebuild when the user wants anything about the plan changed (days, duration, exercises, equipment, focus, goal); otherwise rebuild is null.
When rebuild is set: wishes restates ALL current wishes (existing ones that still apply plus new ones, at most 10); profileChanges contains only the profile fields to change, or null. Available profileChanges fields: equipment, location, limitations, limitationNote, daysPerWeek (1-6), durationMin (10-90), goal. summary is one sentence describing the new plan.
Never agree to train through pain, dizziness or chest symptoms.

Current wishes:
${wishLines(i.wishes)}
Current plan: ${i.planSummary}
Device data: ${statsSummary(i.stats)}
Profile: ${profileJson(i.profile)}

Conversation:
${chat}`;
}
