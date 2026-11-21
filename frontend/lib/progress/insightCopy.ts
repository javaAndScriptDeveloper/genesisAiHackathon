import type { Insight } from "./insights";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Resolves an insight into display copy (conclusion + gentle next step) through the given translator. */
export function insightCopy(i: Insight, t: Translate): { title: string; next: string } {
	const params: Record<string, string | number> = { ...i.vars };
	if (i.id === "weekday_misses") params.weekday = t(`fit.progress.weekdays.${Number(i.vars.weekday)}`);
	return { title: t(`fit.progress.insights.${i.id}.title`, params), next: t(`fit.progress.insights.${i.id}.next`, params) };
}
