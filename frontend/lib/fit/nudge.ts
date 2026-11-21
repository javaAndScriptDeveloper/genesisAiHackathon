// Trainer-voice notification text: what we ask Gemini and how we clean its reply. Pure, safe to import on the client.

export const NUDGE_KINDS = ["workout", "missed", "streak-risk", "streak", "achievement", "weekly-summary"] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];

/** The only data Gemini ever sees about the user: small typed numbers and a workout/badge title. */
export interface NudgeFacts {
	title?: string;
	daysMissed?: number;
	streak?: number;
	minutes?: number;
	done?: number;
	goal?: number;
}

export const NUDGE_MAX_CHARS = 220;

const SITUATION: Record<NudgeKind, string> = {
	workout: "The user has a workout planned for today and has not started it yet. Nudge them to go.",
	missed: "The user missed a planned workout. Check in and get them to do it or move it.",
	"streak-risk": "The user has a training streak and today's workout is not done yet. Warn that the streak is at risk and nudge them to train.",
	streak: "The user just reached a training streak milestone. Celebrate it.",
	achievement: "The user just unlocked an achievement. Congratulate them.",
	"weekly-summary": "The week just ended. Give a one-line recap of how it went.",
};

function factLines(facts: NudgeFacts): string[] {
	const out: string[] = [];
	if (facts.title !== undefined) out.push(`Name: ${facts.title.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim()}`);
	if (facts.daysMissed !== undefined) out.push(`Days since the planned date: ${facts.daysMissed}`);
	if (facts.streak !== undefined) out.push(`Streak in weeks: ${facts.streak}`);
	if (facts.minutes !== undefined) out.push(`Planned minutes: ${facts.minutes}`);
	if (facts.done !== undefined) out.push(`Workouts done: ${facts.done}`);
	if (facts.goal !== undefined) out.push(`Weekly goal: ${facts.goal}`);
	return out;
}

export function buildNudgePrompt(trainer: { name: string; tov: string }, kind: NudgeKind, facts: NudgeFacts): { system: string; prompt: string } {
	const system = [
		`You are ${trainer.name}, a personal fitness trainer writing one push notification to your client.`,
		`Your voice: ${trainer.tov}`,
		"Rules:",
		"- Stay in character the whole time.",
		"- Write at most 2 short sentences, no emojis, no hashtags, no greeting by name.",
		"- Use only the facts given. Never invent numbers, names, workouts or achievements.",
		"- Never shame or comment on the person's body. Never give medical advice.",
		"- Reply with the notification text only, no quotes or labels.",
	].join("\n");
	const lines = factLines(facts);
	const prompt = [SITUATION[kind], ...(lines.length > 0 ? ["Facts:", ...lines.map((l) => `- ${l}`)] : [])].join("\n");
	return { system, prompt };
}

/** Trims a model reply into notification text; null when nothing usable is left or it is over the length cap. */
export function cleanNudgeText(raw: string): string | null {
	let text = raw.replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
	text = text.replace(/^["“”']+|["“”']+$/g, "").trim();
	if (text === "") return null;
	// Too long means the model ignored the rules: keep the template rather than show a sentence cut in half.
	if (text === "" || text.length > NUDGE_MAX_CHARS) return null;
	return text;
}
