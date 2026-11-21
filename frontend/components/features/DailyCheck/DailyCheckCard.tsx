"use client";

import { Cardiogram01Icon, HeartCheckIcon, Moon02Icon, Undo02Icon } from "@hugeicons/core-free-icons";
import { Avatar, Button, Card, Icon, ProgressRing, Skeleton } from "@/components/ui";
import { trainerById, useTrainers } from "@/lib/api/trainers";
import { activeTrainerId } from "@/lib/fit/options";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useAiPlan } from "@/lib/fit/store/useAiPlan";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./DailyCheckCard.module.scss";

/** Today's readiness check in the trainer's voice: last night's (simulated) stats, the note, and Undo when the session changed. */
export function DailyCheckCard() {
	const t = useT();
	const { state, dispatch } = useFit();
	const { busy } = useAiPlan();
	const { data: trainers } = useTrainers();
	const daily = state.daily;
	const trainer = trainerById(trainers, activeTrainerId(state));

	const header = (
		<div className={styles.head}>
			{trainer && <Avatar name={trainer.name} src={trainer.pathToImage} size={44} />}
			<div className={styles.titles}>
				<p className={styles.eyebrow}>{t("fit.ai.daily.eyebrow")}</p>
				<h2 className={styles.title}>{trainer ? `${trainer.name} · ${t("fit.ai.daily.title")}` : t("fit.ai.daily.title")}</h2>
			</div>
		</div>
	);

	if (!daily) {
		if (!busy) return null;
		// The card frame (coach, title) is on screen straight away; only the numbers and the note wait for the server.
		return (
			<Card className={styles.root} aria-busy aria-label={t("fit.ai.daily.loading")}>
				{header}
				<div className={styles.stats}>
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} height="7.2rem" />
					))}
				</div>
				<Skeleton height="1.6rem" />
				<Skeleton width="70%" height="1.6rem" />
			</Card>
		);
	}

	const stats = daily.stats;
	// Undo only when a session was really changed (a rest day has nothing to restore).
	const canUndo = !!daily.original && !daily.undone;
	const items = stats
		? [
				{ icon: Moon02Icon, label: t("fit.ai.daily.sleep"), value: t("fit.ai.daily.sleepValue", { h: stats.sleepHours }) },
				{ icon: HeartCheckIcon, label: t("fit.ai.daily.restingHr"), value: t("fit.ai.daily.hrValue", { bpm: stats.restingHr }) },
				{ icon: Cardiogram01Icon, label: t("fit.ai.daily.hrv"), value: t("fit.ai.daily.hrvValue", { ms: stats.hrvMs }) },
			]
		: [];

	return (
		<Card className={styles.root}>
			<div className={styles.top}>
				{header}
				{stats && (
					<ProgressRing value={stats.readiness} size={64} stroke={6} label={t("fit.ai.daily.readiness")}>
						<span className={styles.ringNum}>{stats.readiness}</span>
					</ProgressRing>
				)}
			</div>
			{items.length > 0 && (
				<dl className={styles.stats}>
					{items.map((i) => (
						<div key={i.label} className={styles.stat}>
							<span className={styles.statIcon}>
								<Icon icon={i.icon} size={18} />
							</span>
							<dd>{i.value}</dd>
							<dt>{i.label}</dt>
						</div>
					))}
				</dl>
			)}
			<p className={styles.note}>{daily.undone ? t("fit.ai.daily.undone") : daily.note}</p>
			<div className={styles.foot}>
				{stats && <p className={styles.caption}>{t("fit.ai.daily.simulated")}</p>}
				{canUndo && (
					<Button size="sm" variant="secondary" iconLeft={Undo02Icon} className={styles.undo} onClick={() => dispatch({ type: "undo-daily" })}>
						{t("fit.ai.daily.undo")}
					</Button>
				)}
			</div>
		</Card>
	);
}
