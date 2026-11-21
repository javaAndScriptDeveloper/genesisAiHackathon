import { addDays } from "./dates";
import type { IsoDate } from "./types";

export const PREMIUM = { historyMonths: 3, detailedCharts: true, personalAdvice: true } as const;

const FREE_HISTORY_DAYS = 91; // ~3 months

/** First visible date of the history; null = no limit. */
export function visibleHistoryFrom(today: IsoDate, isPremium: boolean): IsoDate | null {
	return isPremium ? null : addDays(today, -FREE_HISTORY_DAYS);
}
