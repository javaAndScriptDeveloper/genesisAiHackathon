import { GOALS } from "./options";
import type { Goal } from "./types";

const isGoal = (value: unknown): value is Goal => typeof value === "string" && (GOALS as string[]).includes(value);

/** Reads Gemini's JSON reply (`{"goal":"<preset id>"}`, possibly in code fences). Null when it is not one of the presets. */
export function parseGoalReply(raw: string): Goal | null {
	const json = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
	try {
		const value: unknown = JSON.parse(json);
		if (typeof value !== "object" || value === null || !("goal" in value)) return null;
		return isGoal(value.goal) ? value.goal : null;
	} catch {
		return null;
	}
}
