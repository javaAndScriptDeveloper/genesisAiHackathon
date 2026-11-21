import type { Trainer } from "@/lib/api/onboarding";

// AI-generated trainer personas for "Choose your fighter". Served by the mock API until a real
// AI endpoint generates them; the response contract (`trainersResponseSchema`) stays the same.
export const TRAINERS: Trainer[] = [
	{
		id: "rex",
		name: "Rex Ironside",
		style: "Drill coach",
		tagline: "No excuses. Just reps. I'll push you past what you think you can do.",
		intensity: 3,
		tone: "danger",
		specialties: ["Strength", "Discipline", "HIIT"],
	},
	{
		id: "zoe",
		name: "Zoe Spark",
		style: "Hype buddy",
		tagline: "Every workout is a party and you're the main character. Let's make it fun.",
		intensity: 2,
		tone: "warning",
		specialties: ["Fat loss", "Cardio", "Motivation"],
	},
	{
		id: "max",
		name: "Max Byte",
		style: "Data-driven strength",
		tagline: "Every set is a data point. I'll tune your plan with science, not guesses.",
		intensity: 2,
		tone: "accent",
		specialties: ["Muscle", "Progressive load", "Recovery"],
	},
	{
		id: "luna",
		name: "Luna Calm",
		style: "Mindful mobility",
		tagline: "Strong body, quiet mind. We move well first, then we move more.",
		intensity: 1,
		tone: "success",
		specialties: ["Mobility", "Posture", "Beginners"],
	},
];
