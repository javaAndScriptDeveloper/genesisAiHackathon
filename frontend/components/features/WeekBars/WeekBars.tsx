"use client";

import clsx from "clsx";
import { AnimatedNumber, Card, Icon, SportIcon, type IconDefinition } from "@/components/ui";
import { WEEKDAYS } from "@/lib/fit/dates";
import styles from "./WeekBars.module.scss";

interface WeekBarsProps {
	title: string;
	unit: string;
	/** Seven values, Monday first. */
	values: number[];
	todayIndex: number;
	tone: "accent" | "neutral";
	icon?: IconDefinition;
	sport?: "flame" | "stopwatch";
}

// A week at a glance: total on top, one bar per weekday below, today underlined.
export function WeekBars({ title, unit, values, todayIndex, tone, icon, sport }: WeekBarsProps) {
	const max = Math.max(1, ...values);
	const total = values.reduce((a, b) => a + b, 0);
	return (
		<Card className={styles.card}>
			<span className={styles.title}>
				{icon && <Icon icon={icon} size={14} />}
				{sport && <SportIcon name={sport} size={14} />}
				{title}
			</span>
			<span className={styles.total}>
				<AnimatedNumber value={total} />
				<small>{unit}</small>
			</span>
			<div className={styles.bars} role="img" aria-label={`${title}: ${values.map((v, i) => `${WEEKDAYS[i]} ${v}`).join(", ")} ${unit}`}>
				{values.map((v, i) => (
					<div key={i} className={styles.col}>
						<span className={styles.track}>
							<span className={clsx(styles.fill, styles[tone])} style={{ height: `${Math.max(v > 0 ? 8 : 0, (v / max) * 100)}%` }} />
						</span>
						<span className={clsx(styles.day, i === todayIndex && styles.today)}>{WEEKDAYS[i]?.[0]}</span>
					</div>
				))}
			</div>
		</Card>
	);
}
