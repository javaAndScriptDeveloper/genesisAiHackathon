export interface LevelInfo {
	level: number;
	name: string;
	xp: number;
	into: number;
	span: number;
	pct: number;
}

/** i18n keys of the level names (copy lives in messages/parts/progress.json). */
export const LEVEL_NAMES: string[] = Array.from({ length: 10 }, (_, i) => `fit.progress.levels.${i + 1}`);

const cost = (level: number): number => 250 + 250 * level; // level → level + 1
const threshold = (level: number): number => 125 * (level - 1) * level + 250 * (level - 1); // cumulative XP to reach level

export function levelFor(totalXp: number): LevelInfo {
	const xp = Math.max(0, Math.round(totalXp));
	let level = 1;
	while (xp >= threshold(level + 1)) level++;
	const into = xp - threshold(level);
	const span = cost(level);
	return {
		level,
		name: LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1] ?? "",
		xp,
		into,
		span,
		pct: Math.floor((into / span) * 100),
	};
}
