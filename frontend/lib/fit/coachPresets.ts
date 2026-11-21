import type { Params } from "@/lib/messages";
import { coachReply, type CoachContext, type CoachReply } from "./coach";

export const coachPresets = [
	{ id: "difficulty", request: "My workout is too difficult" },
	{ id: "equipment", request: "I don't have dumbbells" },
	{ id: "time", request: "I only have 20 minutes" },
	{ id: "progress", request: "How am I progressing?" },
	{ id: "today", request: "What should I train today?" },
	{ id: "tired", request: "I feel exhausted" },
] as const;

type CoachPreset = (typeof coachPresets)[number];

export function coachPresetReply(preset: CoachPreset, context: CoachContext, t: (key: string, params?: Params) => string): CoachReply {
	const existing = coachReply(preset.request, context);
	const key = preset.id === "today"
		? context.todayDone ? "todayDone" : context.next ? "todayNext" : "todayEmpty"
		: preset.id;

	return {
		text: t(`fit.coach.presets.replies.${key}`, {
			done: context.weekDone,
			planned: context.weekPlanned,
			workout: context.next?.title ?? "",
			minutes: context.next?.durationMin ?? 0,
		}),
		actions: existing.actions.map((action) => ({
			...action,
			label: t(`fit.coach.presets.actions.${action.id}`),
		})),
	};
}
