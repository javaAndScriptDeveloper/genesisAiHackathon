import { z } from "zod";

// Official Leap Fitness channel. Videos are only ever embedded via YouTube's own player, never downloaded or rehosted.
export const LEAP_CHANNEL_URL = "https://www.youtube.com/@LeapFitnessOfficial";

// Exercise id -> YouTube video id. IDs below were taken from the channel's public video list and each one
// was confirmed embeddable via YouTube oEmbed. Exercises without an entry fall back to a channel search link.
// Override or extend at deploy time with NEXT_PUBLIC_EXERCISE_VIDEO_MAP='{"goblet-squat":"<videoId>"}'.
export const DEFAULT_VIDEO_MAP: Record<string, string> = {
	"push-up": "TGQi4VsPIhU",
	"incline-db-press": "8RR7lUtng8E",
	"decline-db-fly": "_uYTTsO4Bl0",
	"db-reverse-curl": "vM40o2TiJfM",
	"wall-sumo-squat": "oR90gl2vj7c",
	"mountain-pose": "a447URrhNq4",
	"downdog-knee-drives": "08IR1Dc0QdA",
	"crescent-low-lunge": "dXREtCBZnV4",
	"warrior-ii": "YSjBJDkA6zg",
	"walk-the-dog": "PCgS48SiR2k",
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

export interface ExerciseVideo {
	/** Present only when a mapped video exists. */
	embedUrl: string | null;
	watchUrl: string | null;
	/** Always available: opens a search of the channel for this exercise. */
	searchUrl: string;
}

export function videoFor(exerciseId: string, exerciseName: string): ExerciseVideo {
	const id = VIDEO_MAP[exerciseId];
	return {
		embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : null,
		watchUrl: id ? `https://www.youtube.com/watch?v=${id}` : null,
		searchUrl: `${LEAP_CHANNEL_URL}/search?query=${encodeURIComponent(exerciseName)}`,
	};
}
