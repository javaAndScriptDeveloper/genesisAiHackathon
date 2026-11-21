import type { NudgeFacts, NudgeKind } from "./nudge";
import type { AppNotification, FitState } from "./types";

/** Asks the server to write a notification in the trainer's voice. Null on any failure: the template text stays. */
export async function fetchNudge(trainerId: string, nudge: { kind: NudgeKind; facts: NudgeFacts }): Promise<string | null> {
	try {
		const response = await fetch("/api/nudge", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ trainerId, kind: nudge.kind, facts: nudge.facts }),
			signal: AbortSignal.timeout(25_000),
		});
		if (!response.ok) return null;
		const data: unknown = await response.json();
		if (typeof data === "object" && data !== null && "text" in data && typeof data.text === "string" && data.text.trim() !== "") return data.text;
		return null;
	} catch {
		return null;
	}
}

/** The newest unread notification the trainer should still rewrite; null when there is none. */
export function pendingVoice(state: Pick<FitState, "notifications">, tried: ReadonlySet<string>): AppNotification | null {
	return state.notifications.find((n) => n.nudge !== undefined && n.aiText === undefined && !n.aiFailed && !n.read && !tried.has(n.id)) ?? null;
}
