import type { FitState, Goal } from "./types";

// Simulated community for the hackathon demo: fixed sample buddies, fake results and scripted replies.
// A real version needs accounts and a backend (see docs/agent/fitness-app.md).

export interface BuddyResults {
	weeklyWorkouts: number;
	streakWeeks: number;
	lastWorkout: { title: string; daysAgo: number };
	pr: { exercise: string; kg: number };
}

export interface Buddy {
	id: string;
	name: string;
	goal: Goal;
	days: string;
	level: number;
	results: BuddyResults;
}

/** How long a connection request waits for "approval" before the simulated buddy accepts. */
export const ACCEPT_DELAY_MS = 5000;
export const MAX_CHAT_MESSAGES = 50;

export const BUDDIES: Buddy[] = [
	{ id: "maya", name: "Maya K.", goal: "build-muscle", days: "Mon · Wed · Fri", level: 4, results: { weeklyWorkouts: 3, streakWeeks: 6, lastWorkout: { title: "Upper body strength", daysAgo: 1 }, pr: { exercise: "Bench press", kg: 55 } } },
	{ id: "leo", name: "Leo P.", goal: "lose-fat", days: "Tue · Thu · Sat", level: 3, results: { weeklyWorkouts: 3, streakWeeks: 4, lastWorkout: { title: "Full body circuit", daysAgo: 2 }, pr: { exercise: "Goblet squat", kg: 24 } } },
	{ id: "sam", name: "Sam R.", goal: "stay-fit", days: "Mon · Thu", level: 6, results: { weeklyWorkouts: 2, streakWeeks: 11, lastWorkout: { title: "Mobility and core", daysAgo: 3 }, pr: { exercise: "Deadlift", kg: 90 } } },
	{ id: "priya", name: "Priya N.", goal: "endurance", days: "Tue · Fri · Sun", level: 5, results: { weeklyWorkouts: 4, streakWeeks: 8, lastWorkout: { title: "Intervals and legs", daysAgo: 0 }, pr: { exercise: "Walking lunge", kg: 20 } } },
	{ id: "tom", name: "Tom W.", goal: "get-stronger", days: "Mon · Wed · Sat", level: 7, results: { weeklyWorkouts: 3, streakWeeks: 14, lastWorkout: { title: "Heavy lower body", daysAgo: 1 }, pr: { exercise: "Back squat", kg: 120 } } },
];

const REPLIES = [
	"Hey! Great to connect. What does your week look like?",
	"Nice, I'm doing legs on Thursday if you want to join.",
	"Love that. Consistency beats intensity every time.",
	"Same here! Let's keep each other honest this month.",
	"Ha, fair. Want to compare numbers on Sunday?",
	"Sounds like a plan. I'll save you a spot at the rack.",
];
const PHOTO_REPLIES = ["Looking strong! That is real progress.", "Great shot, keep it up!", "Nice one! The work is showing."];

export function buddyReply(buddy: Buddy, sent: { text: string; hasPhoto: boolean }, n: number): string {
	const pool = sent.hasPhoto ? PHOTO_REPLIES : REPLIES;
	const line = pool[(n + buddy.id.length) % pool.length] ?? pool[0] ?? "Nice!";
	return line;
}

/** Frees storage space: strips the photo from the oldest chat message that has one. Null when no chat photos remain. */
export function dropOldestChatPhoto(state: FitState): FitState | null {
	let oldest: { buddyId: string; index: number; at: string } | null = null;
	for (const [buddyId, messages] of Object.entries(state.chats)) {
		messages.forEach((m, index) => {
			if (m.photo && (!oldest || m.at < oldest.at)) oldest = { buddyId, index, at: m.at };
		});
	}
	if (!oldest) return null;
	const { buddyId, index } = oldest;
	return { ...state, chats: { ...state.chats, [buddyId]: (state.chats[buddyId] ?? []).map((m, i) => (i === index ? { ...m, photo: undefined } : m)) } };
}
