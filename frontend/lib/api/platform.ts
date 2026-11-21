import "server-only";
import { z } from "zod";
import { dailyStatsSchema, type DailyStats } from "@/lib/fit/dailyStats";
import type { Profile, PlannedWorkout } from "@/lib/fit/types";

// Server-side calls to platform-backend for AI training plans (users, snapshots, saved plans, trainers).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://platform-backend:3000";
const TIMEOUT_MS = 5000;

export interface PlanData {
	kind: "weekly" | "daily-adjust" | "fallback";
	createdBy: "ai" | "fallback";
	inputs: { profile: Profile; stats: DailyStats[]; wishes: string[] };
	summary: string;
	planned: PlannedWorkout[];
}

const snapshotsSchema = z.object({ snapshots: z.array(dailyStatsSchema) });
const savedSchema = z.object({ id: z.number() });
const trainersSchema = z.object({ trainers: z.array(z.object({ id: z.string(), name: z.string(), tov: z.string() })) });

const FALLBACK_TRAINER = { name: "Coach", tov: "Friendly, clear and encouraging." };

export async function getSnapshots(userId: number, days: number): Promise<DailyStats[]> {
	try {
		const response = await fetch(`${BACKEND_URL}/api/users/${userId}/snapshots?days=${days}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
		if (!response.ok) return [];
		const parsed = snapshotsSchema.safeParse(await response.json());
		return parsed.success ? parsed.data.snapshots : [];
	} catch {
		return [];
	}
}

export async function saveTraining(userId: number, trainerSlug: string, planData: PlanData): Promise<number | null> {
	try {
		const response = await fetch(`${BACKEND_URL}/api/users/${userId}/trainings`, {
			method: "POST",
			headers: { "content-type": "application/json" },
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
