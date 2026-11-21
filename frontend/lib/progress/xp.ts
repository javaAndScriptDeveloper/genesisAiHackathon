import { isQualitySession } from "./days";
import { isRestKept } from "./consistency";
import { personalRecords } from "./records";
import type { History } from "./types";

export interface XpLevel {
	xp: number;
	level: number;
	levelStartXp: number;
	nextLevelXp: number;
}

const SESSION_XP = 100;
const PR_XP = 10;
const REST_XP = 20;

const threshold = (level: number): number => (100 * (level - 1) * level) / 2;

export function levelFor(xp: number): number {
	let n = 1;
	while (xp >= threshold(n + 1)) n++;
	return n;
}

export function xpAndLevel(h: History): XpLevel {
	const prCount = new Map<string, number>();
	for (const r of personalRecords(h)) prCount.set(r.sessionId, (prCount.get(r.sessionId) ?? 0) + 1);

	const sessionsByDay = new Map<string, { id: string; prs: number }>();
	for (const s of h.sessions) {
		if (!isQualitySession(s) || s.date > h.today) continue;
		const cand = { id: s.id, prs: prCount.get(s.id) ?? 0 };
		const cur = sessionsByDay.get(s.date);
		if (!cur || cand.prs > cur.prs || (cand.prs === cur.prs && cand.id < cur.id)) sessionsByDay.set(s.date, cand);
	}
	let xp = 0;
	for (const c of sessionsByDay.values()) xp += SESSION_XP + PR_XP * c.prs;
	for (const p of h.plan) if (p.date <= h.today && isRestKept(h, p.date)) xp += REST_XP;

	const level = levelFor(xp);
	return { xp, level, levelStartXp: threshold(level), nextLevelXp: threshold(level + 1) };
}
