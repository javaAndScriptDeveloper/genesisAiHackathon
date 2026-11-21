"use client";

import { Moon02Icon, PlayIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { fmtWeekdays } from "@/components/features/ProgressCalendar/format";
import { Button, Card, Icon } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { WeekDayState } from "@/lib/progress/mainScreen";
import type { IsoDate } from "@/lib/progress/types";
import styles from "./ProgressWeekGoal.module.scss";

interface ProgressWeekGoalProps {
	days: { date: IsoDate; state: WeekDayState }[];
	done: number;
	goal: number;
	paused: boolean;
	/** Monday-based month of this week, so the calendar opens on it. */
	month: string;
	today: IsoDate;
	onStart?: () => void;
}

/** Weekly goal: quality workouts of the 2–5 target, the seven days of this week and a start button. */
export function ProgressWeekGoal({ days, done, goal, paused, month, today, onStart }: ProgressWeekGoalProps) {
	const { t, locale } = useI18n();
	const nf = new Intl.NumberFormat(locale);
	const names = fmtWeekdays(locale);
	const left = Math.max(0, goal - done);
	// Days still ahead this week, today included: never ask for more workouts than the week has room for.
	const daysLeft = days.filter((d) => d.date >= today).length;
	const hint = paused
		? t("fit.progress.main.goal.paused")
		: left === 0
			? t("fit.progress.main.goal.reached")
			: left > daysLeft
				? t("fit.progress.main.goal.counts")
				: left === 1
					? t("fit.progress.main.goal.leftOne")
					: t("fit.progress.main.goal.left", { n: nf.format(left) });
	const summary = [
		t("fit.progress.main.goal.count", { done: nf.format(done), goal: nf.format(goal) }),
		...days.map((d, i) => t("fit.progress.main.goal.day", { day: names[i] ?? d.date, state: t(`fit.progress.main.goal.state.${d.state}`) })),
	].join(", ");

	return (
		<Card className={styles.root}>
			<Link href={`/progress/calendar?month=${month}`} transitionTypes={["nav-forward"]} className={styles.link} aria-label={t("fit.progress.main.goal.stripAria", { summary })}>
				<span className={styles.eyebrow}>{t("fit.progress.main.goal.title")}</span>
				<span className={styles.count}>
					<strong>{nf.format(done)}</strong>
					<span>{t("fit.progress.main.goal.ofGoal", { goal: nf.format(goal) })}</span>
					<span className={styles.unit}>{t("fit.progress.main.goal.unit")}</span>
				</span>
				<ol className={styles.days} aria-hidden>
					{days.map((d, i) => (
						<li key={d.date} className={styles.day}>
							<span className={styles.dow}>{names[i]}</span>
							<span className={styles.mark} data-state={d.state}>
								{d.state === "done" ? <Icon icon={Tick02Icon} size={16} strokeWidth={2.5} /> : d.state === "rest" ? <Icon icon={Moon02Icon} size={14} /> : Number(d.date.slice(8))}
							</span>
						</li>
					))}
				</ol>
			</Link>
			<p className={styles.hint}>{hint}</p>
			{onStart && (
				<Button iconLeft={PlayIcon} onClick={onStart} className={styles.cta}>
					{t("fit.progress.main.goal.start")}
				</Button>
			)}
		</Card>
	);
}
