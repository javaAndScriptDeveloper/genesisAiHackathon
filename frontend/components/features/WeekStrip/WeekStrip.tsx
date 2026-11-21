"use client";

import clsx from "clsx";
import Link from "next/link";
import { addDays, mondayOf, weekdayIndex, WEEKDAYS, type ISODate } from "@/lib/fit/dates";
import type { PlannedWorkout } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./WeekStrip.module.scss";

interface WeekStripProps {
	planned: PlannedWorkout[];
	today: ISODate;
	weekOffset?: number;
	selected?: ISODate;
	onSelect?: (date: ISODate) => void;
}

// Seven days at a glance: training day, recovery day, done, skipped or missed.
export function WeekStrip({ planned, today, weekOffset = 0, selected, onSelect }: WeekStripProps) {
	const t = useT();
	const start = addDays(mondayOf(today), weekOffset * 7);
	return (
		<ol className={styles.strip} aria-label={t("fit.week.label")}>
			{Array.from({ length: 7 }, (_, i) => {
				const date = addDays(start, i);
				const w = planned.find((p) => p.date === date && !p.adHoc);
				const state = !w ? "rest" : w.status === "completed" ? "done" : w.status === "partial" ? "partial" : w.status === "skipped" ? "skipped" : date < today ? "missed" : "planned";
				const label = `${WEEKDAYS[weekdayIndex(date)]} ${Number(date.slice(8))}: ${w ? `${w.title}, ${t(`fit.week.state.${state}`)}` : t("fit.week.state.rest")}`;
				const body = (
					<>
						<span className={styles.dow}>{WEEKDAYS[weekdayIndex(date)]}</span>
						<span className={styles.dot} data-state={state} />
						<span className={styles.num}>{Number(date.slice(8))}</span>
					</>
				);
				const cls = clsx(styles.day, date === today && styles.today, date === selected && styles.selected);
				return (
					<li key={date}>
						{onSelect ? (
							<button type="button" className={cls} aria-label={label} aria-pressed={date === selected} onClick={() => onSelect(date)}>
								{body}
							</button>
						) : w ? (
							<Link href={`/training/session/${w.id}`} className={cls} aria-label={label}>
								{body}
							</Link>
						) : (
							<span className={cls} aria-label={label}>
								{body}
							</span>
						)}
					</li>
				);
			})}
		</ol>
	);
}
