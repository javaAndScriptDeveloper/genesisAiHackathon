import { addDays, daysBetween, fromISO, mondayOf, mulberry32, type ISODate } from "@/lib/fit/dates";
import type { BrowserEvent } from "./browserEvents";
import { summarizeCohorts, type CohortParticipant } from "./cohorts";

// Deterministic synthetic users. Both dashboard views use these same simulated workouts.
export function createDemoAnalytics(today: ISODate) {
	const latestWeek = mondayOf(today);
	const participants: CohortParticipant[] = [];
	const events: BrowserEvent[] = [];
	const offsets = [1, 3, 7, 9, 12, 14, 17, 21, 25, 30, 38, 44, 52, 59];

	for (let week = 8; week >= 0; week--) {
		const start = addDays(latestWeek, -7 * week);
		const random = mulberry32(Number(start.replaceAll("-", "")));
		const sampleSize = 82 + Math.floor(random() * 35);
		const engagementRate = 0.26 + random() * 0.12;
		for (let index = 0; index < sampleSize; index++) {
			const onboardedOn = addDays(start, index % 7);
			const age = daysBetween(onboardedOn, today);
			const engaged = random() < engagementRate;
			const workoutDays = new Set<number>();
			const qualityWorkouts: number[] = [];
			if (engaged || random() < 0.55) workoutDays.add(0);
			if (engaged) {
				workoutDays.add(2);
				workoutDays.add(5);
			}
			for (const day of offsets) {
				const chance = (engaged ? 0.62 : 0.20) / (1 + day / 13);
				if (random() < chance) workoutDays.add(day);
			}
			const purchasedDay = random() < (engaged ? 0.09 : 0.009) ? 7 + Math.floor(random() * 29) : null;
			const trialDay = purchasedDay === null ? (random() < 0.06 ? 2 : null) : purchasedDay - 7;

			const emit = (event: BrowserEvent["event"], day: number, flags?: Pick<BrowserEvent, "quality" | "completed">) => {
				if (day > age) return;
				const date = fromISO(addDays(onboardedOn, day));
				date.setHours(10 + index % 8);
				events.push({ event, at: date.getTime(), ...flags });
			};

			if (age >= 0) emit("onboarding_completed", 0);
			for (const day of workoutDays) {
				const quality = (engaged && (day === 0 || day === 2 || day === 5)) || random() < 0.64;
				const completed = quality && random() < 0.92;
				emit("workout_started", day);
				emit("workout_completed", day, { quality, completed });
				if (quality && day <= age) qualityWorkouts.push(day);
				if (!completed && random() < 0.66) emit("workout_abandoned", day);
				if (random() < 0.12) emit("workout_paused", day);
				if (random() < 0.08) emit("workout_adapted", day);
				if (random() < 0.21) emit("coach_used", day);
				if (random() < 0.09) emit("achievement_unlocked", day);
			}
			if (random() < 0.21) emit("notification_opened", 3);
			if (trialDay !== null) {
				emit("subscription_viewed", trialDay);
				emit("subscription_started", trialDay);
			} else if (random() < 0.20) {
				emit("subscription_viewed", 2);
			}

			if (age >= 0) {
				participants.push({
					onboardedOn,
					workoutDays: new Set([...workoutDays].filter((day) => day <= age)),
					qualityWorkouts,
					firstPaidDay: purchasedDay !== null && purchasedDay <= age ? purchasedDay : null,
				});
			}
		}
	}

	return { events, cohorts: summarizeCohorts(participants, today) };
}
