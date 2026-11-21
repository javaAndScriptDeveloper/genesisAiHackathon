"use client";

import { Badge, ProgressBar, Sheet } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { WeekDetails } from "@/lib/progress/calendar";
import { fmtPct, fmtShort } from "../format";
import styles from "./WeekSheet.module.scss";

export function WeekSheet({ details, onClose }: { details: WeekDetails | null; onClose: () => void }) {
	const { t, locale } = useI18n();
	const w = details;
	const nf = new Intl.NumberFormat(locale);
	const k = "fit.progress.calendar.week";
	return (
		<Sheet open={w !== null} onClose={onClose} title={w ? t(`${k}.title`, { date: fmtShort(w.weekStart, locale) }) : ""} closeLabel={t("common.close")}>
			{w && (
				<div className={styles.root}>
					{w.future ? (
						<p className={styles.p}>{t(`${k}.future`)}</p>
					) : w.summary.score === null ? (
						<p className={styles.p}>{t(`${k}.noScore`)}</p>
					) : (
						<>
							<div className={styles.score}>
								<span className={styles.label}>{t(`${k}.score`)}</span>
								<strong>
									{nf.format(w.summary.score)}
									<span className={styles.of}>/100</span>
								</strong>
							</div>
							<ProgressBar value={w.summary.score} label={t(`${k}.score`)} tone={w.summary.paused ? "neutral" : "accent"} />
							<p className={styles.formula}>{t(`${k}.formula`, { quality: w.qualityWorkouts, rest: w.creditedRest, planned: w.plannedDays })}</p>
							<dl className={styles.list}>
								<div>
									<dt>{t(`${k}.quality`)}</dt>
									<dd>{nf.format(w.qualityWorkouts)}</dd>
								</div>
								<div>
									<dt>{t(`${k}.restCredited`)}</dt>
									<dd>{nf.format(w.creditedRest)}</dd>
								</div>
								<div>
									<dt>{t(`${k}.planned`)}</dt>
									<dd>{nf.format(w.plannedDays)}</dd>
								</div>
							</dl>
						</>
					)}

					{!w.future && (
						<div className={styles.status}>
							<Badge tone={w.summary.paused ? "neutral" : w.summary.credited ? "success" : w.summary.current ? "accent" : "warning"}>
								{t(`fit.progress.calendar.weekMark.${w.summary.paused ? "paused" : w.summary.credited ? "credited" : w.summary.current ? "current" : "none"}`)}
							</Badge>
							<p className={styles.p}>{t(`${k}.goal`, { n: w.goal })}</p>
							<p className={styles.p}>
								{w.summary.paused ? t(`${k}.paused`) : w.summary.credited ? t(`${k}.credited`) : w.summary.current ? t(`${k}.current`) : t(`${k}.notCredited`)}
							</p>
							{!w.summary.paused && !w.summary.current && <p className={styles.p}>{w.weight !== null ? t(`${k}.weight`, { pct: fmtPct(w.weight, locale) }) : t(`${k}.notCounted`)}</p>}
						</div>
					)}
				</div>
			)}
		</Sheet>
	);
}
