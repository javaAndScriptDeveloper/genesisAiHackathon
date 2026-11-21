import type { PlanResponse } from "./aiApi";
import type { AiDeps } from "./aiClient";
import { toBackendUser } from "./backendUser";
import type { Scenario } from "./dailyStats";
import type { ISODate } from "./dates";
import type { DailyCheck, FitState, PlannedWorkout, Profile } from "./types";

// Pure orchestration with injected deps (no React, no fetch), so it can be tested with fakes.

type Backend = NonNullable<FitState["backend"]>;
interface Base {
	backend: FitState["backend"];
	profile: Profile;
	trainerSlug: string;
	today: ISODate;
}

const deviceTitle = (w: Profile["wearable"]) => (w === "apple" ? "Apple Watch" : w === "garmin" ? "Garmin" : "Demo device");

/** Registers the user and a device (with a first sync) on first use. Null on any failure. */
export async function ensureBackend(deps: AiDeps, s: Base): Promise<Backend | null> {
	if (s.backend) return s.backend;
	try {
		const userId = await deps.createUser(toBackendUser(s.profile, s.trainerSlug, s.today));
		const deviceId = await deps.createDevice(userId, deviceTitle(s.profile.wearable));
		await deps.syncDevice(userId, deviceId, s.today);
		return { userId, deviceId };
	} catch {
		return null;
	}
}

/** Asks for a new AI plan. Null on failure, so the caller keeps the current plan. */
export async function rebuildPlan(deps: AiDeps, s: Base & { wishes: string[] }): Promise<PlanResponse | null> {
	try {
		return await deps.requestPlan({ userId: s.backend?.userId ?? null, profile: s.profile, trainerSlug: s.trainerSlug, wishes: s.wishes, today: s.today });
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
	const { userId, deviceId } = s.backend;
	try {
		await deps.syncDevice(userId, deviceId, s.today, s.scenario);
	} catch {
		// The route copes with missing stats.
	}
	// Re-checking a day that was already adjusted starts from the original session, so adjustments never stack.
	const original = s.daily?.date === s.today && s.daily.original && !s.daily.undone ? s.daily.original : null;
	const planned = original ? s.planned.map((w) => (w.id === original.id ? original : w)) : s.planned;
	const todays = planned.find((w) => w.date === s.today && w.status === "planned" && !w.adHoc) ?? null;
	const upcoming = planned.filter((w) => w.date > s.today && w.status === "planned");
	try {
		const r = await deps.requestDaily({ userId, profile: s.profile, trainerSlug: s.trainerSlug, session: todays, upcoming, wishes: s.wishes, today: s.today });
		return { check: { date: s.today, status: r.status, note: r.note, stats: r.stats, sessionId: r.session?.id ?? todays?.id ?? null }, session: r.session };
	} catch {
		return null;
	}
}

export type SimulateOutcome = "failed" | "lighter" | "recovery" | "restDay" | "unchanged";

/** What the demo simulation did to today: an adjusted session, a rest-day note, or nothing. */
export function simulateOutcome(daily: DailyCheck | null): SimulateOutcome {
	if (!daily) return "failed";
	if (daily.original && daily.status !== "unchanged") return daily.status;
	if (daily.sessionId === null && daily.status !== "unchanged") return "restDay";
	return "unchanged";
}
