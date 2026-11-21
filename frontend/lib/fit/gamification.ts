import { addDays, daysBetween, mondayOf, weekKey, type ISODate } from "./dates";
import { computeStreak, levelInfo, weekStats } from "./stats";
import { massUnit, massValue, type Units } from "./units";
import type { FitState, PlannedWorkout, SessionLog } from "./types";

export type BadgeIcon = "flame" | "medal" | "target" | "heart" | "drop" | "bolt" | "calendar" | "shield";

export interface AchievementDef {
	id: string;
	title: string;
	description: string;
	xp: number;
	icon: BadgeIcon;
}

interface Ctx {
	history: SessionLog[];
	planned: PlannedWorkout[];
	today: ISODate;
	water: FitState["water"];
	waterGoalMl: number;
}

const live = (history: SessionLog[]) => history.filter((l) => !l.demo);

type Check = (ctx: Ctx) => boolean;

export const ACHIEVEMENTS: (AchievementDef & { check: Check })[] = [
	{ id: "first-rep", title: "First Rep", description: "Finish your first guided workout in the app.", xp: 50, icon: "medal", check: (c) => live(c.history).length >= 1 },
	{ id: "five-sessions", title: "Getting Going", description: "Complete 5 workouts.", xp: 60, icon: "target", check: (c) => c.history.length >= 5 },
	{ id: "ten-sessions", title: "Double Digits", description: "Complete 10 workouts.", xp: 100, icon: "target", check: (c) => c.history.length >= 10 },
	{ id: "streak-3", title: "On a Roll", description: "Complete 3 planned workouts in a row.", xp: 60, icon: "flame", check: (c) => computeStreak(c.planned, c.today).current >= 3 },
	{ id: "streak-5", title: "Locked In", description: "Complete 5 planned workouts in a row.", xp: 100, icon: "flame", check: (c) => computeStreak(c.planned, c.today).current >= 5 },
	{ id: "record-breaker", title: "Record Breaker", description: "Set a personal record in a workout.", xp: 75, icon: "bolt", check: (c) => live(c.history).some((l) => l.prs.length > 0) },
	{ id: "adapt-overcome", title: "Adapt & Overcome", description: "Finish a workout you adjusted mid-session.", xp: 50, icon: "shield", check: (c) => live(c.history).some((l) => l.adaptations.length > 0) },
	{
		id: "perfect-week",
		title: "Perfect Week",
		description: "Complete every planned session in a week.",
		xp: 80,
		icon: "calendar",
		check: (c) => {
			const s = weekStats(c.planned, c.history, c.today);
			const prev = weekStats(c.planned, c.history, c.today, -1);
			return (s.planned > 0 && s.done === s.planned) || (prev.planned > 0 && prev.done === prev.planned);
		},
	},
	{
		id: "comeback",
		title: "Comeback",
		description: "Return to training after a week or more away.",
		xp: 60,
		icon: "heart",
		check: (c) => {
			const dates = live(c.history).map((l) => l.date).sort();
			const all = c.history.map((l) => l.date).sort();
			const last = dates[dates.length - 1];
			if (!last) return false;
			const idx = all.lastIndexOf(last);
			const before = all[idx - 1];
			return before !== undefined && daysBetween(before, last) >= 7;
		},
	},
	{
		id: "listen-to-body",
		title: "Listen to Your Body",
		description: "Take a planned recovery day when you needed it.",
		xp: 40,
		icon: "heart",
		check: (c) => c.planned.some((w) => w.status === "skipped" && w.skipReason === "recovery"),
	},
	{
		id: "hydration-hero",
		title: "Hydration Hero",
		description: "Hit your water goal on 3 days.",
		xp: 40,
		icon: "drop",
		check: (c) => Object.values(c.water).filter((ml) => ml >= c.waterGoalMl).length >= 3,
	},
	{ id: "iron-month", title: "Volume Club", description: "Lift a combined 25,000 kg (55,000 lb).", xp: 120, icon: "bolt", check: (c) => c.history.reduce((n, l) => n + l.volumeKg, 0) >= 25_000 },
];

export function evaluateAchievements(state: FitState, today: ISODate): string[] {
	const ctx: Ctx = { history: state.history, planned: state.planned, today, water: state.water, waterGoalMl: state.waterGoalMl };
	return ACHIEVEMENTS.filter((a) => !state.unlocked[a.id] && a.check(ctx)).map((a) => a.id);
}

export function achievementById(id: string): AchievementDef | undefined {
	return ACHIEVEMENTS.find((a) => a.id === id);
}

export function totalXp(state: Pick<FitState, "history" | "unlocked">): number {
	const sessions = state.history.reduce((n, l) => n + l.xp, 0);
	const bonus = Object.keys(state.unlocked).reduce((n, id) => n + (achievementById(id)?.xp ?? 0), 0);
	return sessions + bonus;
}

export function levelOf(state: Pick<FitState, "history" | "unlocked">) {
	return levelInfo(totalXp(state));
}

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
