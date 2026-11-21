import { addDays, mondayOf, type ISODate } from "@/lib/fit/dates";

export const retentionDays = [1, 7, 14, 30] as const;
type RetentionMetric = `d${(typeof retentionDays)[number]}`;
export type CohortMetric = RetentionMetric | "activation" | "paid";

export interface CohortParticipant {
	onboardedOn: ISODate;
	workoutDays: Set<number>;
	qualityWorkouts: number[];
	firstPaidDay: number | null;
}

export interface CohortRow {
	start: ISODate;
	end: ISODate;
	size: number;
	counts: Record<CohortMetric, number | null>;
}

export function summarizeCohorts(participants: CohortParticipant[], today: ISODate): CohortRow[] {
	const groups = new Map<ISODate, CohortParticipant[]>();
	for (const participant of participants) {
		if (participant.onboardedOn > today) continue;
		const week = mondayOf(participant.onboardedOn);
		const group = groups.get(week) ?? [];
		group.push(participant);
		groups.set(week, group);
	}

	return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left)).map(([start, group]) => {
		const end = addDays(start, 6);
		// Publish a percentage only when the whole cohort's observation day has finished.
		const count = (lastDay: number, match: (person: CohortParticipant) => boolean) =>
			addDays(end, lastDay) < today ? group.filter(match).length : null;
		return {
			start,
			end,
			size: group.length,
			counts: {
				d1: count(1, (person) => person.workoutDays.has(1)),
				d7: count(7, (person) => person.workoutDays.has(7)),
				d14: count(14, (person) => person.workoutDays.has(14)),
				d30: count(30, (person) => person.workoutDays.has(30)),
				activation: count(13, (person) => person.qualityWorkouts.filter((day) => day >= 0 && day < 14).length >= 3),
				paid: count(35, (person) => person.firstPaidDay !== null && person.firstPaidDay >= 0 && person.firstPaidDay <= 35),
			},
		};
	});
}
