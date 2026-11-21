// Eval cases for trainer-voice notifications.
// QUOTA WARNING: the eval suite that uses these cases calls the real Gemini API (cases x 2 calls: generate + judge) and
// spends free-tier quota. It is NOT part of the test suite or CI. For the MVP we do not run it routinely; run it on
// demand with:  cd frontend && GEMINI_API_KEY=... bun run eval:nudge   (optionally add: -t mike)
import type { NudgeFacts, NudgeKind } from "@/lib/fit/nudge";

/** Same five trainers as platform-backend/src/trainers.ts, copied so the evals need no running backend. */
export const FIXTURE_TRAINERS: { id: string; name: string; tov: string }[] = [
	{ id: "mike", name: "Mike", tov: "Angry, harsh-truth trainer. Blunt, no sugar-coating, calls out excuses in short sentences with a bit of sarcasm. Never insults the person's body, and safety warnings stay serious." },
	{ id: "john", name: "John", tov: "Supportive big-brother type. Celebrates small wins, stays patient and uses \"we\" language. Always on your side, even after a missed week." },
	{ id: "hanna", name: "Hanna", tov: "Warm and encouraging with gentle humour. Focuses on consistency and on feeling good after a workout rather than on perfection." },
	{ id: "caroline", name: "Caroline", tov: "Warm and encouraging like Hanna, but calmer and more structured. Explains the why behind every step so you trust the plan." },
	{ id: "alex", name: "Alex", tov: "Non-binary trainer, easygoing and curious. Uses neutral language, asks reflective questions and adapts to your mood that day." },
];

export interface EvalCase {
	id: string;
	trainerId: string;
	kind: NudgeKind;
	facts: NudgeFacts;
}

const FACTS: Record<NudgeKind, NudgeFacts> = {
	workout: { title: "Upper body", minutes: 40 },
	missed: { title: "Leg day", daysMissed: 2 },
	"streak-risk": { title: "Full body", streak: 6 },
	streak: { streak: 4 },
	achievement: { title: "First workout" },
	"weekly-summary": { done: 3, goal: 4 },
};

const CORE: NudgeKind[] = ["missed", "streak-risk", "achievement"];
const EXTRA: NudgeKind[] = ["workout", "streak", "weekly-summary"];

export const EVAL_CASES: EvalCase[] = [
	...FIXTURE_TRAINERS.flatMap((t) => CORE.map((kind) => ({ id: `${t.id}-${kind}`, trainerId: t.id, kind, facts: FACTS[kind] }))),
	...EXTRA.map((kind, i) => {
		const t = FIXTURE_TRAINERS[i] ?? FIXTURE_TRAINERS[0];
		return { id: `${t?.id}-${kind}`, trainerId: t?.id ?? "mike", kind, facts: FACTS[kind] };
	}),
];
