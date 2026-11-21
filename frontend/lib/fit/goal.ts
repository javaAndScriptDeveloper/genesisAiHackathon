import type { Goal } from "./types";

// Ordered: the first goal whose keywords appear wins, so specific intents ("stronger", "run") beat broad ones ("fit").
const KEYWORDS: [Goal, RegExp][] = [
	["lose-fat", /(?<!\p{L})(lose|losing|lost|drop|burn|shed|cut|slim|lean(er)?|weight ?loss|fat|kg|kilos?|pounds?|lbs|belly|summer body|схудн|скинути|жир|вага)/u],
	["get-stronger", /(?<!\p{L})(strong(er)?|strength|power(lifting)?|deadlift|bench|squat \d|1 ?rm|pull-?ups?|сил)/u],
	["build-muscle", /(?<!\p{L})(muscle|muscles|bulk|gain|mass|hypertrophy|bigger|abs|biceps|glutes|toned|shape|м'?яз|маса|накач)/u],
	["endurance", /(?<!\p{L})(run|running|marathon|10 ?k|5 ?k|half|endurance|stamina|cardio|cycle|cycling|swim|hike|breath|витривал|біг)/u],
	["stay-fit", /(?<!\p{L})(fit|healthy|health|energy|move|active|feel better|stress|posture|mobility|здоров|енерг|форм)/u],
];

/** Pure fallback for goal parsing when the AI is unavailable. Returns null when nothing matches. */
export function matchGoalKeywords(text: string): Goal | null {
	const lower = text.toLowerCase();
	for (const [goal, re] of KEYWORDS) if (re.test(lower)) return goal;
	return null;
}
