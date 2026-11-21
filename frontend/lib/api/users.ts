import type { Profile } from "@/lib/fit/types";

// The user is identified by the device's progress token (no login yet); the backend upgrades the guest user that
// progress sync would create anyway. Browser reaches it through the `/api/*` fallback rewrite.
export function userPayload(profile: Profile, trainerId: string | null) {
	return {
		name: profile.name.trim(),
		...(profile.gender ? { gender: profile.gender } : {}),
		weightKg: profile.weightKg,
		heightCm: profile.heightCm,
		level: profile.experience,
		daysPerWeek: profile.daysPerWeek,
		durationMin: profile.durationMin,
		...(trainerId ? { trainerId } : {}),
		// The rest of the answers: the AI plan's inputs (users.onboarding).
		onboarding: {
			goal: profile.goal,
			...(profile.goalText ? { goalText: profile.goalText.slice(0, 500) } : {}),
			equipment: profile.equipment,
			location: profile.location,
			limitations: profile.limitations,
			limitationNote: profile.limitationNote.slice(0, 1000),
			wearable: profile.wearable,
		},
	};
}

/** Saves the onboarding profile as a user on the server (an upsert per token, so profile edits re-POST). Never throws: onboarding must not depend on the network. */
export async function createUser(profile: Profile, trainerId: string | null, progressToken: string): Promise<boolean> {
	try {
		const response = await fetch("/api/users", {
			method: "POST",
			headers: { "content-type": "application/json", "x-progress-token": progressToken },
			body: JSON.stringify(userPayload(profile, trainerId)),
		});
		return response.ok;
	} catch {
		return false;
	}
}
