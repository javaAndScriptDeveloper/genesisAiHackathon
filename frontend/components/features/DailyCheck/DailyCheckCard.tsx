"use client";

import { Avatar, Button, Card, Skeleton } from "@/components/ui";
import { useTrainers } from "@/lib/api/trainers";
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
	const trainer = trainers?.find((tr) => tr.id === activeTrainerId(state));

	if (!daily) {
		if (!busy) return null;
		return (
			<Card className={styles.root} aria-busy aria-label={t("fit.ai.daily.loading")}>
				<Skeleton width="40%" height="1.4rem" />
				<div className={styles.head}>
					<Skeleton width="4rem" height="4rem" className={styles.round} />
					<Skeleton width="55%" height="1.8rem" />
				</div>
				<div className={styles.stats}>
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} height="5.6rem" />
					))}
				</div>
				<Skeleton height="1.6rem" />
			</Card>
		);
	}

	const stats = daily.stats;
	// Undo only when a session was really changed (a rest day has nothing to restore).
	const canUndo = !!daily.original && !daily.undone;
	const items = stats
		? [
				{ label: t("fit.ai.daily.sleep"), value: t("fit.ai.daily.sleepValue", { h: stats.sleepHours }) },
				{ label: t("fit.ai.daily.restingHr"), value: t("fit.ai.daily.hrValue", { bpm: stats.restingHr }) },
				{ label: t("fit.ai.daily.hrv"), value: t("fit.ai.daily.hrvValue", { ms: stats.hrvMs }) },
				{ label: t("fit.ai.daily.readiness"), value: t("fit.ai.daily.readinessValue", { n: stats.readiness }) },
			]
		: [];

	return (
		<Card className={styles.root}>
			<p className={styles.eyebrow}>{t("fit.ai.daily.eyebrow")}</p>
			<div className={styles.head}>
				{trainer && <Avatar name={trainer.name} src={trainer.pathToImage} size={40} />}
				<h2 className={styles.title}>{trainer ? `${trainer.name} · ${t("fit.ai.daily.title")}` : t("fit.ai.daily.title")}</h2>
			</div>
			{items.length > 0 && (
				<dl className={styles.stats}>
					{items.map((i) => (
						<div key={i.label} className={styles.stat}>
							<dt>{i.label}</dt>
							<dd>{i.value}</dd>
						</div>
					))}
				</dl>
			)}
			<p className={styles.note}>{daily.undone ? t("fit.ai.daily.undone") : daily.note}</p>
			{stats && <p className={styles.caption}>{t("fit.ai.daily.simulated")}</p>}
			{canUndo && (
				<Button size="sm" variant="secondary" className={styles.undo} onClick={() => dispatch({ type: "undo-daily" })}>
					{t("fit.ai.daily.undo")}
				</Button>
			)}
		</Card>
	);
}
