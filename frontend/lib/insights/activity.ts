import { addDays, daysBetween, toISO } from "@/lib/fit/dates";
import { eventNames, type BrowserEvent } from "./browserEvents";

export const periods = { week: 7, month: 30, quarter: 90 };
export type Period = keyof typeof periods;

export function summarizeActivity(events: BrowserEvent[], period: Period, now: Date) {
	const today = toISO(now);
	const days = periods[period];
	const from = addDays(today, 1 - days);
	const bucketSize = { week: 1, month: 5, quarter: 10 }[period];
	const buckets = Array.from({ length: Math.ceil(days / bucketSize) }, (_, index) => ({
		from: addDays(from, index * bucketSize),
		to: addDays(from, Math.min((index + 1) * bucketSize, days) - 1),
		count: 0,
	}));
	const counts = new Map(eventNames.map((event) => [event, 0]));
	let total = 0;
	let completed = 0;
	let quality = 0;

	for (const entry of events) {
		const date = toISO(new Date(entry.at));
		if (date < from || date > today) continue;
		const bucket = buckets[Math.floor(daysBetween(from, date) / bucketSize)];
		if (bucket) bucket.count++;
		counts.set(entry.event, (counts.get(entry.event) ?? 0) + 1);
		total++;
		if (entry.completed) completed++;
		if (entry.quality) quality++;
	}

	return { buckets, counts, total, completed, quality };
}
