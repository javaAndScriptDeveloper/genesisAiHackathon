"use client";

import { Button, Sheet, useToast } from "@/components/ui";
import { AchievementBadge } from "@/components/features/AchievementBadge/AchievementBadge";
import { achievementById, type AchievementDef } from "@/lib/fit/gamification";
import { shareText } from "@/lib/fit/share";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Celebration.module.scss";

// Milestone moment: all newly unlocked achievements in one sheet, never shown during a workout.
export function Celebration() {
	const { state, dispatch } = useFit();
	const t = useT();
	const toast = useToast();
	const defs = state.celebrate.map(achievementById).filter((d): d is AchievementDef => !!d);
	const busy = !!state.active && state.active.phase !== "summary";
	if (defs.length === 0 || busy) return null;
	const totalXp = defs.reduce((n, d) => n + d.xp, 0);

	const share = async () => {
		const text = t("fit.celebration.shareText", { title: defs.map((d) => d.title).join(", "), description: defs[0]?.description ?? "" });
		const result = await shareText(t("fit.celebration.title"), text);
		if (result === "copied") toast.show(t("fit.common.copied"), "success");
		if (result === "failed") toast.show(t("fit.common.shareFailed"), "danger");
	};

	return (
		<Sheet open onClose={() => dispatch({ type: "dismiss-celebration" })} title={defs.length === 1 ? t("fit.celebration.title") : t("fit.celebration.titleMany", { n: defs.length })} closeLabel={t("common.close")} variant="center">
			<ul className={styles.list}>
				{defs.map((d) => (
					<li key={d.id} className={styles.item}>
						<AchievementBadge icon={d.icon} />
						<span className={styles.text}>
							<strong>{d.title}</strong>
							<span>{d.description}</span>
						</span>
						<span className={styles.xp}>+{d.xp}</span>
					</li>
				))}
			</ul>
			<p className={styles.total}>{t("fit.celebration.total", { n: totalXp })}</p>
			<div className={styles.actions}>
				<Button variant="secondary" onClick={share}>
					{t("fit.common.share")}
				</Button>
				<Button onClick={() => dispatch({ type: "dismiss-celebration" })}>{t("fit.celebration.nice")}</Button>
			</div>
		</Sheet>
	);
}
