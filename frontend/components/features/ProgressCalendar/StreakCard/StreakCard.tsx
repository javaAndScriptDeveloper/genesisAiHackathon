"use client";

import { FireIcon } from "@hugeicons/core-free-icons";
import { Badge, Card, Icon } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./StreakCard.module.scss";

interface StreakCardProps {
	current: number;
	best: number;
	/** No workouts yet (S0): show a hint instead of a zero. */
	empty: boolean;
}

export function StreakCard({ current, best, empty }: StreakCardProps) {
	const { t, locale } = useI18n();
	const nf = new Intl.NumberFormat(locale);
	const k = "fit.progress.calendar.streak";
	return (
		<Card className={styles.root}>
			<div className={styles.head}>
				<h3 className={styles.title}>
					<Icon icon={FireIcon} size={18} />
					{t(`${k}.title`)}
				</h3>
				{!empty && best > 0 && <Badge>{t(`${k}.best`, { n: nf.format(best) })}</Badge>}
			</div>
			{empty ? (
				<p className={styles.p}>{t(`${k}.empty`)}</p>
			) : (
				<>
					<p className={styles.value}>
						<strong>{nf.format(current)}</strong>
						<span>{t(current === 1 ? `${k}.week` : `${k}.weeks`)}</span>
					</p>
					<p className={styles.p}>{t(`${k}.body`)}</p>
				</>
			)}
		</Card>
	);
}
