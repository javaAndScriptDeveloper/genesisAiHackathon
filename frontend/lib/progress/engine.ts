import { badges, type Badge } from "./badges";
import { checkInSummary, type CheckInSummary } from "./checkins";
import { consistencyV2, streakV2, weeklyGoal, type WeekGoalDay } from "./consistency";
import { addDays, weekStart } from "./dates";
import { isQualitySession } from "./days";
import { advice, improvements, type Advice, type Improvement } from "./improvements";
import { levelFor, type LevelInfo } from "./levels";
import { personalRecords, type PersonalRecord } from "./records";
import type { History, ProgressContext } from "./types";
import { xpLedger } from "./xp";

export const ENGINE_VERSION = "2.0.0"; // bump whenever any formula changes

export interface ProgressSnapshot {
	checkIns: CheckInSummary;
	consistency: ReturnType<typeof consistencyV2>;
	streak: { current: number; best: number };
	week: { goal: number; quality: number; days: WeekGoalDay[] };
	level: LevelInfo;
	badges: Badge[];
	records: PersonalRecord[];
	improvements: Improvement[];
	advice: Advice | null;
}

export function progressSnapshot(h: History, ctx: ProgressContext): ProgressSnapshot {
	const ws = weekStart(h.today);
	const we = addDays(ws, 6);
	const goal = Number.isFinite(ctx.weeklyGoal) ? ctx.weeklyGoal : 3;
	const totalXp = xpLedger(h, ctx).reduce((a, e) => a + e.amount, 0);
	return {
		checkIns: checkInSummary(h),
		consistency: consistencyV2(h, ctx),
		streak: streakV2(h, ctx),
		week: {
			goal: Math.min(5, Math.max(2, goal)),
			quality: h.sessions.filter((s) => s.date >= ws && s.date <= we && isQualitySession(s)).length,
			days: weeklyGoal(h).days,
		},
		level: levelFor(totalXp),
		badges: badges(h, ctx),
		records: personalRecords(h),
		improvements: improvements(h, ctx),
		advice: advice(h, ctx),
	};
}

function stable(v: unknown): string {
	if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
	if (v && typeof v === "object") {
		const entries = Object.entries(v)
			.filter(([, x]) => x !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(",")}}`;
	}
	return JSON.stringify(v) ?? "null";
}

/** Stable hash: key-sorted JSON -> FNV-1a 32-bit -> 8 hex chars. */
export function snapshotHash(s: ProgressSnapshot): string {
	const str = stable(s);
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(16).padStart(8, "0");
}
