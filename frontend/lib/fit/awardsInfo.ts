// Presentation data for achievements: how rare each one is and a motivating tip.
// Rarity percentages are illustrative (demo app): there is no real user base behind them yet.

export type Tier = "common" | "rare" | "epic" | "legendary";

export interface AwardInfo {
	/** Share of users who hold this badge, in percent. */
	rarityPct: number;
	tip: string;
}

export const AWARD_INFO: Record<string, AwardInfo> = {
	"first-rep": { rarityPct: 62, tip: "Every habit starts with one session. You already did the hardest part: showing up." },
	"five-sessions": { rarityPct: 41, tip: "Five sessions in is where routines start to feel normal. Keep the rhythm, not the intensity." },
	"ten-sessions": { rarityPct: 23, tip: "Most people stop before ten. Your body is now adapting, so the next ten will feel easier." },
	"streak-3": { rarityPct: 34, tip: "Three in a row builds momentum. Plan the next session before you leave this one." },
	"streak-5": { rarityPct: 11, tip: "Consistency beats intensity. Five planned sessions in a row puts you ahead of most people." },
	"record-breaker": { rarityPct: 18, tip: "A record means you're stronger than last time. Add a little, not a lot, and repeat." },
	"adapt-overcome": { rarityPct: 27, tip: "Adjusting a workout instead of quitting is a skill. Smart athletes do it all the time." },
	"perfect-week": { rarityPct: 3, tip: "A full week of planned sessions is rare. Protect your sleep and the next one is closer than you think." },
	"comeback": { rarityPct: 14, tip: "Coming back is harder than starting. Start light, and let the routine pull you in again." },
	"listen-to-body": { rarityPct: 31, tip: "Rest is training too. Recovering when you need it is what keeps you in the game for years." },
	"hydration-hero": { rarityPct: 38, tip: "Water helps energy and recovery. A glass after every session is an easy way to keep this going." },
	"iron-month": { rarityPct: 2, tip: "25,000 kg lifted is a serious total. Only a tiny share of users reach it. Keep stacking sessions." },
};

export function tierOf(pct: number): Tier {
	if (pct < 5) return "legendary";
	if (pct < 15) return "epic";
	if (pct < 30) return "rare";
	return "common";
}

export function awardInfo(id: string): AwardInfo {
	return AWARD_INFO[id] ?? { rarityPct: 50, tip: "Keep going. Small steady steps add up." };
}

export const LEVEL_NAMES = ["Rookie", "Mover", "Regular", "Athlete", "Pro", "Elite", "Champion", "Legend"];

export function levelName(level: number): string {
	return LEVEL_NAMES[Math.min(Math.max(level, 1), LEVEL_NAMES.length) - 1] ?? "Rookie";
}
