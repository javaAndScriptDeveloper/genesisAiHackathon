"use client";

import { Avatar, Badge, Button, Card, Skeleton } from "@/components/ui";
import { useTrainers } from "@/lib/api/trainers";
import { activeTrainerId } from "@/lib/fit/options";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useAiPlan } from "@/lib/fit/store/useAiPlan";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./DailyCheckCard.module.scss";

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
			<Card className={styles.root} aria-busy>
				<div className={styles.head}>
					<Skeleton width="4rem" height="4rem" className={styles.round} />
					<Skeleton width="55%" height="1.8rem" />
				</div>
				<Skeleton height="6rem" />
				<Skeleton height="1.6rem" />
			</Card>
		);
	}

	const stats = daily.stats;
	const canUndo = daily.status !== "unchanged" && !daily.undone;
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
			<div className={styles.head}>
				{trainer && <Avatar name={trainer.name} src={trainer.pathToImage} size={40} />}
				<h2 className={styles.title}>{trainer ? `${trainer.name} · ${t("fit.ai.daily.title")}` : t("fit.ai.daily.title")}</h2>
				{stats && <Badge tone="warning">{t("fit.ai.daily.demo")}</Badge>}
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
			{canUndo && (
				<Button size="sm" variant="secondary" onClick={() => dispatch({ type: "undo-daily" })}>
					{t("fit.ai.daily.undo")}
				</Button>
			)}
		</Card>
	);
}
