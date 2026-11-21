import type { ISODate } from "./dates";
import type { Profile } from "./types";

export interface BackendUserBody {
	name: string;
	gender: string | null;
	dob: string;
	weightKg: number;
	heightCm: number;
	level: string;
	trainerSlug: string;
	onboarding: Omit<Profile, "name" | "age" | "gender" | "heightCm" | "weightKg" | "experience">;
}

export function toBackendUser(profile: Profile, trainerSlug: string, today: ISODate): BackendUserBody {
	const { name, age, gender, heightCm, weightKg, experience, ...onboarding } = profile;
	const [year = "1970", month = "01", day = "01"] = today.split("-");
	const safeDay = month === "02" && day === "29" ? "28" : day;
	return {
		name,
		gender: gender === "private" ? null : gender,
		dob: `${Number(year) - age}-${month}-${safeDay}`,
		weightKg,
		heightCm,
		level: experience,
		trainerSlug,
		onboarding,
	};
}
