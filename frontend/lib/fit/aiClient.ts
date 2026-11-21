import { z } from "zod";
import { ApiError } from "../api/types";
import { coachResponseSchema, dailyResponseSchema, planResponseSchema, type CoachRequest, type CoachResponse, type DailyRequest, type DailyResponse, type PlanRequest, type PlanResponse } from "./aiApi";
import type { BackendUserBody } from "./backendUser";
import { dailyStatsSchema, type DailyStats, type Scenario } from "./dailyStats";
import type { ISODate } from "./dates";

// Browser client for the backend (through the /api rewrite) and the Next AI routes. Every response is zod-parsed.

async function call<T>(method: "POST" | "PATCH", url: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
	let response: Response;
	try {
		response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
	} catch {
		throw new ApiError("Network error", 0);
	}
	if (!response.ok) throw new ApiError(`Request failed: ${method} ${url}`, response.status);
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

async function createUser(body: BackendUserBody): Promise<number> {
	return (await call("POST", "/api/users", body, idSchema)).id;
}
async function patchUser(id: number, body: Partial<BackendUserBody>): Promise<void> {
	await call("PATCH", `/api/users/${id}`, body, idSchema);
}
async function createDevice(userId: number, title: string): Promise<number> {
	return (await call("POST", `/api/users/${userId}/devices`, { title }, idSchema)).id;
}
async function syncDevice(userId: number, deviceId: number, date: ISODate, scenario?: Scenario): Promise<DailyStats> {
	return (await call("POST", `/api/users/${userId}/devices/${deviceId}/sync`, scenario ? { date, scenario } : { date }, snapshotSchema)).snapshot;
}
async function requestPlan(body: PlanRequest): Promise<PlanResponse> {
	return call("POST", "/api/plan", body, planResponseSchema);
}
async function requestDaily(body: DailyRequest): Promise<DailyResponse> {
	return call("POST", "/api/plan/daily", body, dailyResponseSchema);
}
async function requestCoach(body: CoachRequest): Promise<CoachResponse> {
	return call("POST", "/api/coach", body, coachResponseSchema);
}

export const aiClient = { createUser, patchUser, createDevice, syncDevice, requestPlan, requestDaily, requestCoach };
export type AiDeps = typeof aiClient;
