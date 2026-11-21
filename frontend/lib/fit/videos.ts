import { z } from "zod";
import type { Exercise, Muscle } from "./types";

// Official Leap Fitness channel. Videos are only ever embedded via YouTube's own player, never downloaded or rehosted.
export const LEAP_CHANNEL_URL = "https://www.youtube.com/@LeapFitnessOfficial";

// Exercise id -> YouTube video id. IDs below were taken from the channel's public video list and each one
// was confirmed embeddable via YouTube oEmbed. Exercises without a match use a labeled related clip.
// Override or extend at deploy time with NEXT_PUBLIC_EXERCISE_VIDEO_MAP='{"goblet-squat":"<videoId>"}'.
export const DEFAULT_VIDEO_MAP: Record<string, string> = {
	"push-up": "TGQi4VsPIhU",
	"incline-db-press": "8RR7lUtng8E",
	"decline-db-fly": "_uYTTsO4Bl0",
	"db-reverse-curl": "vM40o2TiJfM",
	"wall-sumo-squat": "oR90gl2vj7c",
	"mountain-pose": "a447URrhNq4",
	"downdog-knee-drives": "08IR1Dc0QdA",
	"warrior-ii": "YSjBJDkA6zg",
	"sphinx-pose": "7a_WhOoegHE",
	"happy-baby": "z-BjiGQZe4s",
	"single-leg-hops": "kjjsk2M6DVw",
};

const overrideSchema = z.record(z.string(), z.string().regex(/^[\w-]{11}$/));

function readOverrides(): Record<string, string> {
	const raw = process.env.NEXT_PUBLIC_EXERCISE_VIDEO_MAP;
	if (!raw) return {};
	try {
		const parsed = overrideSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : {};
	} catch {
		return {};
	}
}

const VIDEO_MAP: Record<string, string> = { ...DEFAULT_VIDEO_MAP, ...readOverrides() };

const PUSH_UP = { id: "TGQi4VsPIhU", title: "Push-ups" };
const HOPS = { id: "kjjsk2M6DVw", title: "Single right leg hops" };
const SIDE_ANGLE = { id: "lqOuqA1Ii7U", title: "Revolved side angle" };
const SHOULDER_OPENER = { id: "AKhSglU4YVw", title: "Standing forward bend with shoulder opener" };
const WARRIOR = { id: "YSjBJDkA6zg", title: "Warrior II" };
const HUMBLE_WARRIOR = { id: "a6ANkE4emF8", title: "Humble warrior" };
const CACTUS_LUNGE = { id: "93kUVEAqiv8", title: "Crescent low lunge with cactus arms" };
const HAPPY_BABY = { id: "z-BjiGQZe4s", title: "Happy baby pose" };
const CRESCENT_LUNGE = { id: "VQwrouNIlXw", title: "Crescent low lunge with arm extended up" };
const DOWN_DOG = { id: "_tE3e84OEpo", title: "Down dog with bent knee" };
const CHAIR_POSE = { id: "pQOK2-E-5sM", title: "Revolved chair pose" };
const HALF_BEND = { id: "twUDaY6WbOM", title: "Half forward bend" };
const BOAT_POSE = { id: "ii245b_MNxI", title: "Boat pose with alternating legs" };

const RELATED_VIDEOS: Record<Muscle, readonly [{ id: string; title: string }, ...{ id: string; title: string }[]]> = {
	chest: [PUSH_UP],
	back: [HALF_BEND, SIDE_ANGLE],
	legs: [WARRIOR, CHAIR_POSE, CRESCENT_LUNGE],
	glutes: [HUMBLE_WARRIOR, CACTUS_LUNGE],
	shoulders: [SHOULDER_OPENER, CACTUS_LUNGE],
	arms: [PUSH_UP],
	core: [BOAT_POSE],
	cardio: [HOPS],
	mobility: [DOWN_DOG, HAPPY_BABY, HALF_BEND, SIDE_ANGLE, HUMBLE_WARRIOR, CACTUS_LUNGE, CHAIR_POSE],
};

const RELATED_BY_EXERCISE: Partial<Record<string, { id: string; title: string }>> = {
	"crescent-low-lunge": CRESCENT_LUNGE,
	"walk-the-dog": DOWN_DOG,
	"glute-bridge": HUMBLE_WARRIOR,
};

export function videoFor(exercise: Exercise) {
	const exactId: string | undefined = VIDEO_MAP[exercise.id];
	const related = RELATED_VIDEOS[exercise.muscle];
	const clipIndex = Array.from(exercise.id).reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 0) % related.length;
	const clip = related[clipIndex] ?? related[0];
	const relatedClip = RELATED_BY_EXERCISE[exercise.id] ?? clip;
	const id = exactId ?? relatedClip.id;

	return {
		id,
		embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`,
		watchUrl: `https://www.youtube.com/watch?v=${id}`,
		searchUrl: `${LEAP_CHANNEL_URL}/search?query=${encodeURIComponent(exercise.name)}`,
		relatedTitle: exactId ? null : relatedClip.title,
	};
}
