"use client";

import { FireIcon, Share08Icon, Target02Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { fmtShort } from "@/components/features/ProgressCalendar/format";
import { Icon, IconButton } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { consistencyBars } from "@/lib/progress/mainScreen";
import type { IsoDate } from "@/lib/progress/types";
import styles from "./ProgressScoreCards.module.scss";

interface ProgressScoreCardsProps {
	/** True until the first workout: one hint replaces both cards (no verdict-like zeros). */
	fresh: boolean;
	consistency: { score: number | null; weeks: { weekStart: IsoDate; score: number; weight: number }[] };
	streak: { current: number; best: number };
	/** Shares this week's progress (goal, streak, level) through the system share sheet or the clipboard. */
	onShare: () => void;
}

const BARS = 4;

/** Consistency (weighted score of the last 4 finished weeks) and streak (credited weeks in a row); both open the calendar. */
export function ProgressScoreCards({ fresh, consistency, streak, onShare }: ProgressScoreCardsProps) {
	const { t, locale } = useI18n();
	const nf = new Intl.NumberFormat(locale);

	if (fresh) {
		return (
			<div className={styles.root}>
				<Link href="/progress/calendar" transitionTypes={["nav-forward"]} className={`${styles.card} ${styles.first}`}>
					<Icon icon={Target02Icon} size={24} className={styles.icon} />
					<span className={styles.text}>
						<strong>{t("fit.progress.main.first.title")}</strong>
						<span>{t("fit.progress.main.first.body")}</span>
					</span>
				</Link>
			</div>
		);
	}

	const bars = consistencyBars(consistency.weeks);
	const slots = [...Array.from({ length: Math.max(0, BARS - bars.length) }, () => null), ...bars.slice(-BARS)];
	const barsLabel = t("fit.progress.main.consistency.barsAria", { list: bars.map((w) => `${fmtShort(w.weekStart, locale)} ${nf.format(w.score)}`).join(", ") });

	return (
		<div className={styles.root}>
			<Link href="/progress/calendar" transitionTypes={["nav-forward"]} className={styles.card}>
				<span className={styles.title}>{t("fit.progress.main.consistency.title")}</span>
				{consistency.score === null ? (
					<span className={styles.note}>{t("fit.progress.consistencyEmpty")}</span>
				) : (
					<>
						<span className={styles.value}>
							<strong>{nf.format(consistency.score)}</strong>
							<span>{t("fit.progress.main.consistency.of")}</span>
						</span>
						<span className={styles.bars} role="img" aria-label={barsLabel}>
							{slots.map((w, i) => (
								<span key={w?.weekStart ?? `empty-${i}`} className={styles.bar} data-empty={w === null || undefined}>
									<span style={{ height: `${Math.max(8, w?.score ?? 0)}%` }} />
								</span>
							))}
						</span>
						<span className={styles.note}>{t("fit.progress.main.consistency.note")}</span>
					</>
				)}
			</Link>
			<div className={styles.streak}>
				<Link href="/progress/calendar" transitionTypes={["nav-forward"]} className={styles.card}>
					<span className={styles.title}>
						<Icon icon={FireIcon} size={16} className={styles.icon} />
						{t("fit.progress.main.streak.title")}
					</span>
					<span className={styles.value}>
						<strong>{nf.format(streak.current)}</strong>
						<span>{streak.current === 1 ? t("fit.progress.main.streak.week") : t("fit.progress.main.streak.weeks")}</span>
					</span>
					<span className={styles.note}>{streak.current === 0 && streak.best === 0 ? t("fit.progress.main.streak.zero") : t("fit.progress.main.streak.best", { n: nf.format(streak.best) })}</span>
				</Link>
				<IconButton icon={Share08Icon} label={t("fit.progress.main.streak.share")} onClick={onShare} className={styles.share} />
			</div>
		</div>
	);
}
