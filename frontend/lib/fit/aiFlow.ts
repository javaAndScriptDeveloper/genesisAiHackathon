import type { PlanResponse } from "./aiApi";
import type { AiDeps } from "./aiClient";
import type { Scenario } from "./dailyStats";
import type { ISODate } from "./dates";
import type { DailyCheck, FitState, PlannedWorkout, Profile } from "./types";

// Pure orchestration with injected deps (no React, no fetch), so it can be tested with fakes.
// The user is the browser's progress token (FitState.progressToken); `backend` is only the demo device under it.

type Backend = NonNullable<FitState["backend"]>;
interface Base {
	backend: FitState["backend"];
	profile: Profile;
	trainerSlug: string;
	today: ISODate;
	token: string;
}

const deviceTitle = (w: Profile["wearable"]) => (w === "apple" ? "Apple Watch" : w === "garmin" ? "Garmin" : "Demo device");

/**
 * A saved `backend` from before the token-scoped routes was `{ userId, deviceId }`: that device belongs to a numeric
 * user the token cannot reach, so it is dropped and a fresh device is registered under the token on next use.
 */
export function tokenBackend(value: unknown): FitState["backend"] {
	if (typeof value !== "object" || value === null || "userId" in value) return null;
	const deviceId = (value as { deviceId?: unknown }).deviceId;
	return typeof deviceId === "number" && Number.isInteger(deviceId) && deviceId > 0 ? { deviceId } : null;
}

/** Saves the user (POST /api/users) and registers a device with a first sync on first use. Null on any failure. */
export async function ensureBackend(deps: AiDeps, s: Base): Promise<Backend | null> {
	if (s.backend) return s.backend;
	try {
		if (!(await deps.saveUser(s.profile, s.trainerSlug, s.token))) return null;
		const deviceId = await deps.createDevice(s.token, deviceTitle(s.profile.wearable));
		await deps.syncDevice(s.token, deviceId, s.today);
		return { deviceId };
	} catch {
		return null;
	}
}

/** Asks for a new AI plan. Null on failure, so the caller keeps the current plan. */
export async function rebuildPlan(deps: AiDeps, s: Pick<Base, "profile" | "trainerSlug" | "today" | "token"> & { wishes: string[] }): Promise<PlanResponse | null> {
	try {
		return await deps.requestPlan(s.token, { profile: s.profile, trainerSlug: s.trainerSlug, wishes: s.wishes, today: s.today });
	} catch {
		return null;
	}
}

export async function dailyCheck(
	deps: AiDeps,
	s: Base & { planned: PlannedWorkout[]; wishes: string[]; daily: DailyCheck | null; scenario?: Scenario; force?: boolean },
): Promise<{ check: Omit<DailyCheck, "original" | "undone">; session: PlannedWorkout | null } | null> {
	if (!s.backend) return null;
	if (s.daily?.date === s.today && !s.force) return null;
	try {
		await deps.syncDevice(s.token, s.backend.deviceId, s.today, s.scenario);
	} catch {
		// The route copes with missing stats.
	}
	// Re-checking a day that was already adjusted starts from the original session, so adjustments never stack.
	const original = s.daily?.date === s.today && s.daily.original && !s.daily.undone ? s.daily.original : null;
	const planned = original ? s.planned.map((w) => (w.id === original.id ? original : w)) : s.planned;
	const todays = planned.find((w) => w.date === s.today && w.status === "planned" && !w.adHoc) ?? null;
	const upcoming = planned.filter((w) => w.date > s.today && w.status === "planned");
	try {
		const r = await deps.requestDaily(s.token, { profile: s.profile, trainerSlug: s.trainerSlug, session: todays, upcoming, wishes: s.wishes, today: s.today });
		return { check: { date: s.today, status: r.status, note: r.note, stats: r.stats, sessionId: r.session?.id ?? todays?.id ?? null }, session: r.session };
	} catch {
		return null;
	}
}

export type SimulateOutcome = "failed" | "lighter" | "recovery" | "restDay" | "unchanged";

/** What the simulated night did to today: an adjusted session, a rest-day note, or nothing. */
export function simulateOutcome(daily: DailyCheck | null): SimulateOutcome {
	if (!daily) return "failed";
	if (daily.original && daily.status !== "unchanged") return daily.status;
	if (daily.sessionId === null && daily.status !== "unchanged") return "restDay";
	return "unchanged";
}
