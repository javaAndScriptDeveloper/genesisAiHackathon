"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import Link from "next/link";
import { AchievementBadge } from "@/components/features/AchievementBadge/AchievementBadge";
import { Badge as Tag, Icon, ProgressBar } from "@/components/ui";
import { BADGE_ICON } from "@/lib/fit/awardsInfo";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Badge } from "@/lib/progress/badges";
import type { LevelInfo } from "@/lib/progress/levels";
import styles from "./ProgressLevelBar.module.scss";

interface ProgressLevelBarProps {
	level: LevelInfo;
	/** Up to 3 closest locked badges (nextBadges). */
	next: Badge[];
	/** Up to 3 newest earned badges (recentBadges). */
	recent: Badge[];
	/** An unseen level-up: the card gets a soft accent highlight until it is seen. */
	newLevel: boolean;
}

/** Level and XP, the next achievements with their progress and the recently earned ones. Opens Achievements. */
export function ProgressLevelBar({ level, next, recent, newLevel }: ProgressLevelBarProps) {
	const { t, locale } = useI18n();
	const nf = new Intl.NumberFormat(locale);
	const name = t(level.name);
	const remaining = Math.max(0, level.span - level.into);

	return (
		<Link href="/progress/achievements" transitionTypes={["nav-forward"]} className={clsx(styles.root, newLevel && styles.highlight)}>
			<span className={styles.head}>
				<span className={styles.title}>{t("fit.progress.main.level.title", { level: nf.format(level.level), name })}</span>
				{newLevel && <Tag tone="accent">{t("fit.progress.main.level.new")}</Tag>}
				<Icon icon={ArrowRight01Icon} size={18} className={styles.chevron} />
			</span>
			{level.xp === 0 ? (
				<span className={styles.note}>{t("fit.progress.main.level.empty")}</span>
			) : (
				<>
					<span className={styles.xp}>{t("fit.progress.main.level.xp", { into: nf.format(level.into), span: nf.format(level.span) })}</span>
					<span aria-hidden className={styles.bar}>
						<ProgressBar value={level.pct} label={name} />
					</span>
					<span className={styles.note}>{t("fit.progress.main.level.toNext", { n: nf.format(remaining), next: nf.format(level.level + 1) })}</span>
				</>
			)}

			{next.length > 0 && (
				<span className={styles.section}>
					<span className={styles.label}>{t("fit.progress.main.achievements.next")}</span>
					<span className={styles.next}>
						{next.map((b) => (
							<span key={b.id} className={styles.item}>
								<AchievementBadge icon={BADGE_ICON[b.id]} awardId={b.id} locked />
								<span className={styles.itemTitle}>{t(`fit.progress.badge.${b.id}.title`)}</span>
								<span aria-hidden className={styles.itemBar}>
									<ProgressBar value={(b.current / Math.max(1, b.target)) * 100} label={t(`fit.progress.badge.${b.id}.title`)} tone="neutral" />
								</span>
								<span className={styles.itemNote}>{t("fit.progress.main.achievements.more", { n: nf.format(b.remaining) })}</span>
							</span>
						))}
					</span>
				</span>
			)}

			{recent.length > 0 && (
				<span className={styles.section}>
					<span className={styles.label}>{t("fit.progress.main.achievements.recent")}</span>
					<span className={styles.recent}>
						{recent.map((b) => (
							<span key={b.id} className={styles.recentItem}>
								<AchievementBadge icon={BADGE_ICON[b.id]} awardId={b.id} />
								<span className={styles.itemTitle}>{t(`fit.progress.badge.${b.id}.title`)}</span>
							</span>
						))}
					</span>
				</span>
			)}
		</Link>
	);
}
