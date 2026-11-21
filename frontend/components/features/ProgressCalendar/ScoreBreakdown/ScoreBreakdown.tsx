"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Card, Icon, ProgressBar } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { addDays } from "@/lib/progress/dates";
import type { IsoDate } from "@/lib/progress/types";
import { fmtPct, fmtShort } from "../format";
import styles from "./ScoreBreakdown.module.scss";

interface ScoreBreakdownProps {
	score: number | null;
	weeks: { weekStart: IsoDate; score: number; weight: number }[];
	onWeek: (weekStart: IsoDate) => void;
}

/** "How N was built": the counted weeks of consistencyV2 with their weights; each row opens that week. */
export function ScoreBreakdown({ score, weeks, onWeek }: ScoreBreakdownProps) {
	const { t, locale } = useI18n();
	const nf = new Intl.NumberFormat(locale);
	const k = "fit.progress.calendar.built";
	return (
		<Card className={styles.root}>
			<h3 className={styles.title}>{score === null ? t(`${k}.titleEmpty`) : t(`${k}.title`, { score: nf.format(score) })}</h3>
			{score === null || weeks.length === 0 ? (
				<p className={styles.p}>{t(`${k}.empty`)}</p>
			) : (
				<>
					<ul className={styles.list}>
						{weeks.map((w) => {
							const range = t(`${k}.range`, { from: fmtShort(w.weekStart, locale), to: fmtShort(addDays(w.weekStart, 6), locale) });
							const pct = fmtPct(w.weight, locale);
							return (
								<li key={w.weekStart}>
									<button type="button" className={styles.row} aria-label={t(`${k}.rowAria`, { range, score: nf.format(w.score), pct })} onClick={() => onWeek(w.weekStart)}>
										<span className={styles.range}>
											{range}
											<span className={styles.weight}>{t(`${k}.weight`, { pct })}</span>
										</span>
										<span aria-hidden className={styles.bar}>
											<ProgressBar value={w.score} label={range} />
										</span>
										<strong className={styles.score}>{nf.format(w.score)}</strong>
										<Icon icon={ArrowRight01Icon} size={16} className={styles.chevron} />
									</button>
								</li>
							);
						})}
					</ul>
					<p className={styles.p}>{t(`${k}.body`)}</p>
				</>
			)}
		</Card>
	);
}
