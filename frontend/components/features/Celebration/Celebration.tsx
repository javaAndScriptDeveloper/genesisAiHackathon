"use client";

import { Button, Sheet, useToast } from "@/components/ui";
import { AchievementBadge } from "@/components/features/AchievementBadge/AchievementBadge";
import { BADGE_ICON, isBadgeId } from "@/lib/fit/awardsInfo";
import { shareText } from "@/lib/fit/share";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useProgress } from "@/lib/fit/store/hooks";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { celebrationGroup } from "@/lib/progress/events";
import { LEVEL_NAMES } from "@/lib/progress/levels";
import styles from "./Celebration.module.scss";

// Milestone moment: every unseen badge and level-up from lib/progress in one window, never shown during a workout.
export function Celebration() {
	const { state, dispatch, ready } = useFit();
	const { level: current } = useProgress();
	const { t, locale } = useI18n();
	const toast = useToast();
	const group = celebrationGroup(state.progressEvents ?? []);
	const busy = !!state.active && state.active.phase !== "summary";
	// Saved state is only read on the client: render nothing until hydration is done (no SSR mismatch).
	if (!ready || !group || busy) return null;
	const badges = group.badges.filter(isBadgeId);
	const level = group.level !== null && Number.isFinite(group.level) ? group.level : null;
	const count = badges.length + (level !== null ? 1 : 0);
	if (count === 0) return null;
	const levelName = level !== null ? t(LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1] ?? current.name) : "";

	const close = () => dispatch({ type: "mark-seen", kinds: ["badge", "level"], now: new Date().toISOString() });
	const share = async () => {
		const titles = [...badges.map((id) => t(`fit.progress.badge.${id}.title`)), ...(level !== null ? [t("fit.celebration.level", { level, name: levelName })] : [])];
		const first = badges[0];
		const text = t("fit.celebration.shareText", { title: titles.join(", "), description: first ? t(`fit.progress.badge.${first}.desc`) : levelName });
		const result = await shareText(t("fit.celebration.title"), text);
		if (result === "copied") toast.show(t("fit.common.copied"), "success");
		if (result === "failed") toast.show(t("fit.common.shareFailed"), "danger");
	};

	return (
		<Sheet open onClose={close} title={count === 1 ? t("fit.celebration.title") : t("fit.celebration.titleMany", { n: count })} closeLabel={t("common.close")} variant="center">
			<ul className={styles.list}>
				{level !== null && (
					<li className={styles.item}>
						<AchievementBadge icon="medal" />
						<span className={styles.text}>
							<strong>{t("fit.celebration.level", { level, name: levelName })}</strong>
							<span>{t("fit.celebration.levelBody", { xp: new Intl.NumberFormat(locale).format(current.xp) })}</span>
						</span>
					</li>
				)}
				{badges.map((id) => (
					<li key={id} className={styles.item}>
						<AchievementBadge icon={BADGE_ICON[id]} awardId={id} />
						<span className={styles.text}>
							<strong>{t(`fit.progress.badge.${id}.title`)}</strong>
							<span>{t(`fit.progress.badge.${id}.desc`)}</span>
						</span>
					</li>
				))}
			</ul>
			<div className={styles.actions}>
				<Button variant="secondary" onClick={share}>
					{t("fit.common.share")}
				</Button>
				<Button onClick={close}>{t("fit.celebration.nice")}</Button>
			</div>
		</Sheet>
	);
}
