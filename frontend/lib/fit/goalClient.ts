import { GOALS } from "./options";
import type { Goal } from "./types";

export type GoalMatch = { status: "matched"; goal: Goal } | { status: "none" } | { status: "unavailable" };

/** Asks `/api/goal` for the closest preset. `unavailable` = the service failed (no key, provider or network error); `none` = it answered but nothing fits. */
export async function matchGoal(text: string): Promise<GoalMatch> {
	try {
		const response = await fetch("/api/goal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
		if (!response.ok) return { status: "unavailable" };
		const data: unknown = await response.json();
		const goal = typeof data === "object" && data !== null && "goal" in data ? GOALS.find((g) => g === data.goal) : undefined;
		return goal ? { status: "matched", goal } : { status: "none" };
	} catch {
		return { status: "unavailable" };
	}
}
