import "server-only";
import { buildNudgePrompt, cleanNudgeText, type NudgeFacts, type NudgeKind } from "@/lib/fit/nudge";
import { nudgeViolations } from "@/lib/fit/nudgeGuard";
import { askGemini } from "./gemini";

/**
 * One notification text in the trainer's voice. Null when Gemini answered with nothing usable or the text breaks a guard
 * rule (invented number, emoji, body shaming...): the caller then keeps the deterministic template text.
 */
export async function writeNudge(trainer: { name: string; tov: string }, kind: NudgeKind, facts: NudgeFacts): Promise<string | null> {
	const { system, prompt } = buildNudgePrompt(trainer, kind, facts);
	const text = cleanNudgeText(await askGemini({ system, prompt }));
	if (text === null) return null;
	const violations = nudgeViolations(text, facts);
	if (violations.length > 0) {
		console.warn("nudge rejected", { kind, violations });
		return null;
	}
	return text;
}
