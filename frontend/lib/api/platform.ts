import "server-only";
import { z } from "zod";
import { dailyStatsSchema, type DailyStats } from "@/lib/fit/dailyStats";
import { PROGRESS_TOKEN_HEADER } from "@/lib/fit/progressToken";
import type { Profile, PlannedWorkout } from "@/lib/fit/types";

// Server-side calls to platform-backend for AI training plans (snapshots, saved plans, trainers). The user is the
// browser's progress token, forwarded as `x-progress-token` to the token-scoped `/api/me/...` routes.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://platform-backend:3000";
const TIMEOUT_MS = 5000;

export interface PlanData {
	kind: "weekly" | "daily-adjust" | "fallback";
	createdBy: "ai" | "fallback";
	inputs: { profile: Profile; stats: DailyStats[]; wishes: string[] };
	summary: string;
	why?: string[];
	planned: PlannedWorkout[];
}

const snapshotsSchema = z.object({ snapshots: z.array(dailyStatsSchema) });
const savedSchema = z.object({ id: z.number() });
const trainersSchema = z.object({ trainers: z.array(z.object({ id: z.string(), name: z.string(), tov: z.string() })) });

const FALLBACK_TRAINER = { name: "Coach", tov: "Friendly, clear and encouraging." };

/** The latest snapshot per day for the last `days` days, oldest first; [] on any failure. */
export async function getSnapshots(token: string, days: number): Promise<DailyStats[]> {
	try {
		const response = await fetch(`${BACKEND_URL}/api/me/snapshots?days=${days}`, { headers: { [PROGRESS_TOKEN_HEADER]: token }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
		if (!response.ok) return [];
		const parsed = snapshotsSchema.safeParse(await response.json());
		return parsed.success ? parsed.data.snapshots : [];
	} catch {
		return [];
	}
}

/** Saves a plan version for the token's user; the new row id, or null on any failure. */
export async function saveTraining(token: string, trainerSlug: string, planData: PlanData): Promise<number | null> {
	try {
		const response = await fetch(`${BACKEND_URL}/api/me/trainings`, {
			method: "POST",
			headers: { "content-type": "application/json", [PROGRESS_TOKEN_HEADER]: token },
			body: JSON.stringify({ trainerSlug, planData }),
			cache: "no-store",
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) return null;
		const parsed = savedSchema.safeParse(await response.json());
		return parsed.success ? parsed.data.id : null;
	} catch {
		return null;
	}
}

export async function getTrainerTov(slug: string): Promise<{ name: string; tov: string }> {
	try {
		const response = await fetch(`${BACKEND_URL}/api/trainers`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
		if (!response.ok) return FALLBACK_TRAINER;
		const parsed = trainersSchema.safeParse(await response.json());
		const trainer = parsed.success ? parsed.data.trainers.find((t) => t.id === slug) : undefined;
		return trainer ? { name: trainer.name, tov: trainer.tov } : FALLBACK_TRAINER;
	} catch {
		return FALLBACK_TRAINER;
	}
}
