"use client";

import { Analytics02Icon, ArrowDownRight01Icon, ArrowUpRight01Icon, BulbIcon, Calendar03Icon, Share08Icon, Target01Icon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { AnimatedNumber, Card, Icon, IconButton, useToast } from "@/components/ui";
import { shareText } from "@/lib/fit/share";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useFitStats } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./TrainingInsight.module.scss";

// The week at a glance: a headline that reflects the actual state, three live metrics and one coaching tip.
export function TrainingInsight() {
	const t = useT();
	const toast = useToast();
	const { state } = useFit();
	const stats = useFitStats();
	const { week, lastWeek, consistency, streak, goal } = stats;

	const change = lastWeek.volume > 0 ? Math.round(((week.volume - lastWeek.volume) / lastWeek.volume) * 100) : null;
	const up = change === null || change >= 0;

	const headline =
		state.history.length === 0
			? t("fit.insight.headNone")
			: goal.done >= goal.target
				? t("fit.insight.headDone")
				: goal.done > 0
					? t("fit.insight.headSome", { left: Math.max(0, goal.target - goal.done) })
					: t("fit.insight.headFresh");

	const tip =
		consistency !== null && consistency >= 90 ? t("fit.insight.tipConsistent") : change !== null && change < -15 ? t("fit.insight.tipVolumeDown") : streak.current >= 3 ? t("fit.insight.tipStreak", { n: streak.current }) : t("fit.insight.tipDefault");

	const share = async () => {
		const r = await shareText(t("fit.progress.shareTitle"), t("fit.progress.shareText", { done: goal.done, planned: goal.target, streak: streak.current, level: stats.level.level }));
		toast.show(r === "copied" ? t("fit.common.copied") : r === "failed" ? t("fit.common.shareFailed") : t("fit.progress.shared"), r === "failed" ? "danger" : "success");
	};

	return (
		<Card className={styles.card}>
			<div className={styles.head}>
				<span className={styles.plate}>
					<Icon icon={Analytics02Icon} size={20} />
				</span>
				<div className={styles.titles}>
					<p className={styles.eyebrow}>{t("fit.progress.insight")}</p>
					<h3 className={styles.headline}>{headline}</h3>
				</div>
				<IconButton icon={Share08Icon} label={t("fit.common.share")} onClick={share} />
			</div>

			<div className={styles.tiles}>
				<div className={styles.tile}>
					<span className={styles.tileLabel}>
						<Icon icon={Calendar03Icon} size={14} />
						{t("fit.progress.sessions")}
					</span>
					<strong className={styles.tileValue}>
						<AnimatedNumber value={goal.done} />/<AnimatedNumber value={goal.target} />
					</strong>
				</div>
				<div className={styles.tile}>
					<span className={styles.tileLabel}>
						<Icon icon={Target01Icon} size={14} />
						{t("fit.progress.consistency")}
					</span>
					<strong className={styles.tileValue}>
						{consistency === null ? "–" : <AnimatedNumber value={consistency} suffix="%" />}
					</strong>
				</div>
				<div className={styles.tile}>
					<span className={styles.tileLabel}>
						<Icon icon={up ? ArrowUpRight01Icon : ArrowDownRight01Icon} size={14} />
						{t("fit.progress.volume")}
					</span>
					<strong className={clsx(styles.tileValue, change !== null && (up ? styles.good : styles.low))}>
						{change === null ? "–" : <AnimatedNumber value={change} prefix={change > 0 ? "+" : ""} suffix="%" />}
					</strong>
				</div>
			</div>

			<p className={styles.tip}>
				<Icon icon={BulbIcon} size={16} />
				<span>{tip}</span>
			</p>
		</Card>
	);
}
