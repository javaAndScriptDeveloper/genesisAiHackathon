import { addDays, weekStart } from "./dates";
import type { History, IsoDate } from "./types";

export interface CheckInSummary {
	lastWeighIn: { date: IsoDate; kg: number } | null;
	weighInsThisWeek: number;
	weighInsLast4Weeks: number;
	photos: number;
	lastPhotoDate: IsoDate | null;
	goalKg: number | null;
	toGoalKg: number | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function checkInSummary(h: History): CheckInSummary {
	const weights = h.checkIns.filter((c) => c.kind === "weight" && c.weightKg !== undefined);
	const latest = [...weights].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)).pop();
	const lastWeighIn = latest && latest.weightKg !== undefined ? { date: latest.date, kg: latest.weightKg } : null;
	const mon = weekStart(h.today);
	const sun = addDays(mon, 6);
	const from4 = addDays(h.today, -27);
	const photos = h.checkIns.filter((c) => c.kind === "photo");
	const goals = h.checkIns.filter((c) => c.kind === "goal" && c.goalKg !== undefined).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
	const goalKg = goals.length ? (goals[goals.length - 1]?.goalKg ?? null) : null;
	return {
		lastWeighIn,
		weighInsThisWeek: weights.filter((c) => c.date >= mon && c.date <= sun).length,
		weighInsLast4Weeks: weights.filter((c) => c.date >= from4 && c.date <= h.today).length,
		photos: photos.length,
		lastPhotoDate: photos.reduce<IsoDate | null>((m, c) => (m === null || c.date > m ? c.date : m), null),
		goalKg,
		toGoalKg: lastWeighIn && goalKg !== null ? r1(lastWeighIn.kg - goalKg) : null,
	};
}
