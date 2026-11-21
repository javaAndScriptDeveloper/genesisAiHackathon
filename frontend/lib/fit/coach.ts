import { getExercise } from "./exercises";
import { levelInfo } from "./stats";
import type { CoachAction, Equipment, Limitation, PlannedWorkout, Profile } from "./types";

export interface CoachContext {
	profile: Profile;
	/** Today's workout, or the next planned one. */
	next: PlannedWorkout | undefined;
	todayDone: boolean;
	inSession: boolean;
	streak: number;
	weekDone: number;
	weekPlanned: number;
	consistency: number;
	xp: number;
	sessions: number;
	lastPr: string | null;
	premium: boolean;
}

export interface CoachReply {
	text: string;
	actions: CoachAction[];
	safety?: boolean;
}

export const SUGGESTED_PROMPTS = ["Fewer leg days", "I can only train at home", "More cardio", "Shorter sessions", "My knee hurts", "How am I progressing?"];

export const SAFETY_TEXT = [
	"Stop exercising now and sit or lie down somewhere comfortable.",
	"Rest and breathe slowly. Do not push through chest pain, dizziness, fainting or severe discomfort.",
	"If symptoms are severe, do not ease within a few minutes, or you feel unsafe, contact local emergency services (112 / 911) or a medical professional.",
	"Only return to training once you feel normal, and consider checking in with a doctor first.",
];

const SAFETY = /chest (pain|tight|pressure)|dizz|light-?headed|faint|pass(ed|ing)? out|short(ness)? of breath|can'?t breathe|numb|palpitation|heart (racing|pounding)|severe (pain|discomfort)|sharp pain|nausea/;

/** The fixed reply for symptom messages, shared by the regex coach and the AI coach route. */
export function safetyReplyText(): string {
	return `Please stop and look after yourself first. ${SAFETY_TEXT.join(" ")} I won't change your plan for this, since the priority is how you feel right now.`;
}

export function isSafetyConcern(text: string): boolean {
	return SAFETY.test(text.toLowerCase());
}

const EQUIPMENT_WORDS: [RegExp, Equipment, string][] = [
	[/dumbbell|weights/, "dumbbells", "dumbbells"],
	[/barbell|bar\b/, "barbell", "a barbell"],
	[/bench/, "bench", "a bench"],
	[/machine|gym/, "machines", "machines"],
	[/band/, "bands", "resistance bands"],
	[/jump rope|skipping rope/, "jump-rope", "a jump rope"],
];

const LIMITATION_WORDS: [RegExp, Limitation, string][] = [
	[/knee/, "knees", "knees"],
	[/back/, "lower-back", "lower back"],
	[/shoulder/, "shoulders", "shoulders"],
	[/wrist/, "wrists", "wrists"],
];

const go = (id: string, label: string, href: string): CoachAction => ({ id, label, type: "go", href });

function nextLine(ctx: CoachContext): string {
	if (!ctx.next) return "You have no sessions planned right now.";
	return `${ctx.next.title} (${ctx.next.durationMin} min, ${ctx.next.exercises.length} exercises)`;
}

export function coachReply(input: string, ctx: CoachContext): CoachReply {
	const text = input.toLowerCase().trim();
	const where = ctx.inSession ? "this workout" : "your next workout";

	if (isSafetyConcern(text)) {
		return {
			safety: true,
			text: safetyReplyText(),
			actions: [],
		};
	}

	for (const [re, equipment, label] of EQUIPMENT_WORDS) {
		if (new RegExp(`(no|don'?t have|without|missing|out of|lost) (any |my |the |a )?(${re.source})`).test(text)) {
			return {
				text: `No problem. I can swap every exercise that needs ${label} for one you can do, and keep your sets and structure the same.`,
				actions: [{ id: `eq-${equipment}`, label: `Replace ${label} exercises`, type: "remove-equipment", equipment }],
			};
		}
	}

	const minutes = /(\d{1,3})\s*(min|mins|minutes)\b/.exec(text)?.[1];
	if (minutes && /(only|just|have|got|short|time|quick)/.test(text)) {
		const m = Math.min(90, Math.max(10, Number(minutes)));
		return {
			text: `Got it, ${m} minutes. I'll keep your main lifts and trim accessory work and extra sets so ${where} fits.`,
			actions: [{ id: `time-${m}`, label: `Fit ${where} into ${m} min`, type: "adapt", op: { kind: "shorten", minutes: m } }],
		};
	}

	for (const [re, limitation, label] of LIMITATION_WORDS) {
		if (re.test(text) && /(hurt|pain|sore|ache|injur|bother|twinge|tweak)/.test(text) && !/exhaust|tired/.test(text)) {
			return {
				text: `Thanks for telling me. I'll avoid exercises that load your ${label} in upcoming sessions and swap in alternatives. If the pain is sharp, getting worse or lasts more than a few days, please see a professional.`,
				actions: [{ id: `lim-${limitation}`, label: `Avoid ${label} stress`, type: "avoid-limitation", limitation }],
			};
		}
	}

	if (/too (hard|difficult|heavy)|difficult|struggl|can'?t (do|finish|keep)|killing me/.test(text)) {
		return {
			text: `That's useful feedback. I'll lower the load, soften reps and add a little rest for the rest of ${where}. Completed sets stay as they are.`,
			actions: [{ id: "hard", label: `Make ${where} easier`, type: "adapt", op: { kind: "too-hard" } }],
		};
	}

	if (/too easy|bored|not (hard|challenging)|harder|more challenge/.test(text)) {
		return {
			text: "Love the energy. I'll nudge the remaining sets up a little. Progress works best in small steps.",
			actions: [{ id: "easy", label: "Add a little challenge", type: "adapt", op: { kind: "harder" } }],
		};
	}

	if (/exhaust|tired|fatigue|drained|no energy|burn(ed|t) out|worn out|sore|sleep/.test(text)) {
		const actions: CoachAction[] = [{ id: "tired", label: `Lighter version of ${where}`, type: "adapt", op: { kind: "tired" } }];
		if (!ctx.inSession && ctx.next && !ctx.todayDone) actions.push({ id: "recover", label: "Take a recovery day (keeps your streak)", type: "recovery-day" });
		return { text: "Listening to your body is part of training. You can do a lighter session, or take a full recovery day. A recovery skip won't break your streak.", actions };
	}

	if (/progress|how am i|how('?s| is) it going|doing|stats|streak|level/.test(text)) {
		const lvl = levelInfo(ctx.xp);
		const parts = [
			`You're level ${lvl.level} with ${ctx.xp.toLocaleString("en-US")} XP and ${ctx.sessions} workouts logged.`,
			`This week: ${ctx.weekDone} of ${ctx.weekPlanned} planned sessions done. Consistency over the last 4 weeks is ${ctx.consistency}%.`,
			ctx.streak > 0 ? `Your streak is ${ctx.streak} planned session${ctx.streak === 1 ? "" : "s"} in a row, and rest days never break it.` : "Your streak restarts with your next planned session.",
			ctx.lastPr ? `Latest personal record: ${ctx.lastPr}.` : "",
		];
		return { text: parts.filter(Boolean).join(" "), actions: [go("see-progress", "Open Progress", "/progress")] };
	}

	if (/today|what should i|what do i|next workout|train now|workout now/.test(text)) {
		if (ctx.todayDone)
			return { text: "You've already trained today. Nice work. Recovery is part of the plan, so a short walk or mobility session is plenty.", actions: [go("mob", "Open training", "/training")] };
		if (!ctx.next) return { text: "Nothing is planned. Adjust your days in your profile and I'll rebuild the week.", actions: [go("prefs", "Edit preferences", "/profile/edit")] };
		return {
			text: `Next up: ${nextLine(ctx)}. Focus: ${ctx.next.focus}. ${ctx.profile.limitations.length ? "Exercises that conflict with your reported limitations are already excluded." : ""}`.trim(),
			actions: [go("start-next", "View workout", `/training/session/${ctx.next.id}`)],
		};
	}

	if (/\brest\b|recover|day off|skip/.test(text)) {
		return {
			text: "Taking a recovery day is a smart move when you need it. It counts as neutral for your streak, and I'll keep your plan on track.",
			actions: ctx.next && !ctx.inSession ? [{ id: "recover", label: "Take a recovery day", type: "recovery-day" }] : [],
		};
	}

	if (/new plan|rebuild|change (my )?plan|update (my )?plan|re-?plan|different plan/.test(text)) {
		return {
			text: ctx.premium ? "I'll rebuild your upcoming weeks from your latest preferences and training history." : "Rebuilding the whole plan from your history is a Premium feature. Small adjustments to today's workout stay free.",
			actions: [{ id: "rebuild", label: "Rebuild my plan", type: "rebuild-plan", premium: true }],
		};
	}

	if (/hi\b|hello|hey|thanks|thank you/.test(text)) {
		return { text: `Hey ${ctx.profile.name}! I'm here for plan tweaks, form questions and motivation. What do you need today?`, actions: [] };
	}

	if (ctx.next) {
		const first = ctx.next.exercises[0];
		return {
			text: `I can adjust ${where}, swap exercises, shorten sessions or plan recovery. Try one of the suggestions below${first ? `, or ask about ${getExercise(first.exerciseId).name}` : ""}.`,
			actions: [],
		};
	}
	return { text: "I can adjust workouts, swap exercises, shorten sessions or plan recovery. Try one of the suggestions below.", actions: [] };
}
