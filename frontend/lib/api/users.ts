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
	};
}

/** Saves the onboarding profile as a user on the server. Never throws: onboarding must not depend on the network. */
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
