import { z } from "zod";

export type Scenario = "normal" | "tired" | "bad-night";
export type DailyStatus = "unchanged" | "lighter" | "recovery";

export type DailyStats = {
	date: string;
	sleepHours: number;
	sleepScore: number;
	restingHr: number;
	hrvMs: number;
	steps: number;
	activeKcal: number;
	readiness: number;
	source: "demo";
	scenario: Scenario;
};

/** Mirrors the platform-backend DailyStats. */
export const dailyStatsSchema: z.ZodType<DailyStats> = z.object({
	date: z.string(),
	sleepHours: z.number(),
	sleepScore: z.number(),
	restingHr: z.number(),
	hrvMs: z.number(),
	steps: z.number(),
	activeKcal: z.number(),
	readiness: z.number(),
	source: z.literal("demo"),
	scenario: z.enum(["normal", "tired", "bad-night"]),
});

export function statusForReadiness(readiness: number): DailyStatus {
	if (readiness >= 60) return "unchanged";
	if (readiness >= 40) return "lighter";
	return "recovery";
}

export function statsSummary(stats: DailyStats[]): string {
	const first = stats[0];
	const last = stats[stats.length - 1];
	if (!first || !last) return "No device data.";
	const avgSleep = stats.reduce((sum, s) => sum + s.sleepHours, 0) / stats.length;
	return `${stats.length} days: avg sleep ${avgSleep.toFixed(1)} h, resting HR ${first.restingHr}→${last.restingHr}, HRV ${first.hrvMs}→${last.hrvMs} ms, readiness today ${last.readiness}/100 (${last.scenario})`;
}
