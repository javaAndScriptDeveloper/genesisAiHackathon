import { dropOldestChatPhoto } from "../community";
import { emptyState } from "../seed";
import type { FitState } from "../types";

export const STORAGE_KEY = "fit.state.v1";

function isFitState(value: unknown): value is FitState {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return v.version === 1 && Array.isArray(v.planned) && Array.isArray(v.history) && Array.isArray(v.notifications) && typeof v.water === "object" && typeof v.subscription === "object";
}

export function loadState(): FitState {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return emptyState();
		const parsed: unknown = JSON.parse(raw);
		return isFitState(parsed) ? { ...emptyState(), ...parsed } : emptyState();
	} catch {
		return emptyState();
	}
}

export function saveState(state: FitState): void {
	let next = state;
	for (;;) {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			return;
		} catch {
			// Storage full or unavailable. Shed the oldest chat photo and retry so workouts and settings still save;
			// with none left, the session keeps working in memory.
			const smaller = dropOldestChatPhoto(next);
			if (!smaller) return;
			next = smaller;
		}
	}
}
