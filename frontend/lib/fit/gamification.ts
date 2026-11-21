import { addDays, mondayOf, weekKey, type ISODate } from "./dates";
import { weekStats } from "./stats";
import { massUnit, massValue, type Units } from "./units";
import type { FitState } from "./types";

// Streak, XP, levels and achievements live in lib/progress (the single source). This file keeps the weekly challenge.
export type BadgeIcon = "flame" | "medal" | "target" | "heart" | "drop" | "bolt" | "calendar" | "shield";

export interface Challenge {
	id: string;
	title: string;
	description: string;
	progress: number;
	target: number;
	unit: string;
	complete: boolean;
	weekKey: string;
}

export function weeklyChallenge(state: Pick<FitState, "history" | "planned" | "water" | "waterGoalMl"> & { units?: Units }, today: ISODate): Challenge {
	const units: Units = state.units ?? "metric";
	const key = weekKey(today);
	const week = Number(key.split("-W")[1] ?? 0);
	const start = mondayOf(today);
	const stats = weekStats(state.planned, state.history, today);
	const variant = week % 3;
	const make = (c: Omit<Challenge, "complete" | "weekKey">): Challenge => ({ ...c, complete: c.target > 0 && c.progress >= c.target, weekKey: key });
	if (variant === 0)
		return make({ id: "planned", title: "Show up for the plan", description: "Finish every session planned this week. Rest days are part of it.", progress: stats.done, target: Math.max(1, stats.planned), unit: "sessions" });
	if (variant === 1)
	{
		const target = units === "metric" ? 4000 : 10_000;
		return make({ id: "volume", title: `Move ${target.toLocaleString("en-US")} ${massUnit(units)}`, description: "Total weight lifted across this week's sessions.", progress: Math.min(target, massValue(stats.volume, units)), target, unit: massUnit(units) });
	}
	const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => (state.water[d] ?? 0) >= state.waterGoalMl).length;
	return make({ id: "water", title: "Hydration streak", description: "Reach your daily water goal on 4 days this week.", progress: days, target: 4, unit: "days" });
}

export const MOTIVATION = [
	"Consistency beats intensity. Today's session is the one that counts.",
	"You don't need a perfect day, just a started one.",
	"Rest is when your body adapts. Honor the plan, rest days included.",
	"Small weights, clean reps, every week. That's how progress compounds.",
	"Show up for the warm-up and the rest takes care of itself.",
];

export function motivationFor(today: ISODate): string {
	const n = Number(today.replaceAll("-", ""));
	return MOTIVATION[n % MOTIVATION.length] ?? MOTIVATION[0] ?? "";
}
