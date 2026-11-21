// Presentation data for achievements: how rare each one is and a motivating tip.
// Rarity percentages are illustrative (demo app): there is no real user base behind them yet.

import type { BadgeId } from "../progress/badges";
import type { BadgeIcon } from "./gamification";

export type Tier = "common" | "rare" | "epic" | "legendary";

export interface AwardInfo {
	/** Share of users who hold this badge, in percent. */
	rarityPct: number;
	tip: string;
}

// Keyed by lib/progress badge ids (the engine's list). Titles and descriptions live in messages (fit.progress.badge.<id>).
export const AWARD_INFO: Record<BadgeId, AwardInfo> = {
	"first-workout": { rarityPct: 62, tip: "Every habit starts with one session. You already did the hardest part: showing up." },
	"perfect-week": { rarityPct: 21, tip: "Every planned workout in one week. Protect your sleep and the next one is closer than you think." },
	"streak-2": { rarityPct: 40, tip: "Two weeks at your goal builds momentum. Plan next week's sessions before Monday." },
	"streak-4": { rarityPct: 22, tip: "A month of weeks at your goal. The routine is starting to run itself." },
	"streak-6": { rarityPct: 12, tip: "Six weeks in a row puts you ahead of most people. Keep the rhythm, not the intensity." },
	"streak-10": { rarityPct: 6, tip: "Ten weeks at your goal. Use a pause for holidays or illness so life never costs you the streak." },
	"streak-20": { rarityPct: 2, tip: "Twenty weeks in a row is rare. This is what long-term training looks like." },
	"first-pr": { rarityPct: 45, tip: "A record means you're stronger than last time. Add a little, not a lot, and repeat." },
	"prs-5": { rarityPct: 18, tip: "Five records: steady progression is working. Keep the small steps." },
	"workouts-20": { rarityPct: 23, tip: "Most people stop before twenty. Your body is now adapting, so the next ones feel easier." },
	"workouts-50": { rarityPct: 8, tip: "Fifty quality workouts. Training is part of your week now." },
	"workouts-100": { rarityPct: 3, tip: "A hundred quality workouts. Only a small share of users get here." },
};

/** Medallion art per engine badge (AchievementBadge picks the image from this icon). */
export const BADGE_ICON: Record<BadgeId, BadgeIcon> = {
	"first-workout": "medal",
	"perfect-week": "calendar",
	"streak-2": "flame",
	"streak-4": "flame",
	"streak-6": "flame",
	"streak-10": "flame",
	"streak-20": "flame",
	"first-pr": "bolt",
	"prs-5": "bolt",
	"workouts-20": "target",
	"workouts-50": "target",
	"workouts-100": "target",
};

export const isBadgeId = (id: string): id is BadgeId => id in BADGE_ICON;

export function tierOf(pct: number): Tier {
	if (pct < 5) return "legendary";
	if (pct < 15) return "epic";
	if (pct < 30) return "rare";
	return "common";
}

export function awardInfo(id: string): AwardInfo {
	return (isBadgeId(id) ? AWARD_INFO[id] : undefined) ?? { rarityPct: 50, tip: "Keep going. Small steady steps add up." };
}
