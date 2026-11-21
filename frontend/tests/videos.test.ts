import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/lib/fit/exercises";
import { LOCAL_VIDEO_IDS, videoFor } from "@/lib/fit/videos";

describe("exercise videos", () => {
	it("every exercise has a self-hosted clip that exists on disk", () => {
		for (const exercise of EXERCISES) {
			const { src } = videoFor(exercise);
			expect(src, exercise.id).toMatch(/^\/video\/[\w-]+\.mp4$/);
			expect(existsSync(path.join(process.cwd(), "public", src ?? "")), `${exercise.id} -> ${src}`).toBe(true);
		}
	});

	it("an exercise with its own clip uses it, and a fallback is stable", () => {
		for (const id of LOCAL_VIDEO_IDS) {
			const exercise = EXERCISES.find((e) => e.id === id);
			if (exercise) expect(videoFor(exercise).src).toBe(`/video/${id}.mp4`);
		}
		const other = EXERCISES.find((e) => !LOCAL_VIDEO_IDS.has(e.id));
		if (other) expect(videoFor(other).src).toBe(videoFor(other).src);
	});
});
