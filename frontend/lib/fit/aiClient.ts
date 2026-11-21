import { z } from "zod";
import { createUser } from "../api/users";
import { ApiError } from "../api/types";
import { coachResponseSchema, dailyResponseSchema, planResponseSchema, type CoachRequest, type CoachResponse, type DailyRequest, type DailyResponse, type PlanRequest, type PlanResponse } from "./aiApi";
import { dailyStatsSchema, type DailyStats, type Scenario } from "./dailyStats";
import type { ISODate } from "./dates";
import { PROGRESS_TOKEN_HEADER } from "./progressToken";

// Browser client for the backend (through the /api rewrite) and the Next AI routes. Every call carries the progress
// token (`x-progress-token`); every response is zod-parsed.

async function call<T>(token: string, url: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
	let response: Response;
	try {
		response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", [PROGRESS_TOKEN_HEADER]: token }, body: JSON.stringify(body) });
	} catch {
		throw new ApiError("Network error", 0);
	}
	if (!response.ok) throw new ApiError(`Request failed: POST ${url}`, response.status);
	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new ApiError("Invalid JSON response", response.status);
	}
	const parsed = schema.safeParse(data);
	if (!parsed.success) throw new ApiError(`Unexpected response from ${url}`, response.status);
	return parsed.data;
}

const idSchema = z.object({ id: z.number().int() });
const snapshotSchema = z.object({ snapshot: dailyStatsSchema });

async function createDevice(token: string, title: string): Promise<number> {
	return (await call(token, "/api/me/devices", { title }, idSchema)).id;
}
async function syncDevice(token: string, deviceId: number, date: ISODate, scenario?: Scenario): Promise<DailyStats> {
	return (await call(token, `/api/me/devices/${deviceId}/sync`, scenario ? { date, scenario } : { date }, snapshotSchema)).snapshot;
}
async function requestPlan(token: string, body: PlanRequest): Promise<PlanResponse> {
	return call(token, "/api/plan", body, planResponseSchema);
}
async function requestDaily(token: string, body: DailyRequest): Promise<DailyResponse> {
	return call(token, "/api/plan/daily", body, dailyResponseSchema);
}
async function requestCoach(token: string, body: CoachRequest): Promise<CoachResponse> {
	return call(token, "/api/coach", body, coachResponseSchema);
}

/** `saveUser` is the team's `createUser` (POST /api/users, an upsert per token): true when stored. */
export const aiClient = { saveUser: createUser, createDevice, syncDevice, requestPlan, requestDaily, requestCoach };
export type AiDeps = typeof aiClient;
