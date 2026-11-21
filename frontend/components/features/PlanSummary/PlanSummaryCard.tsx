"use client";

import { Avatar, Badge, Card } from "@/components/ui";
import { trainerById, useTrainers } from "@/lib/api/trainers";
import { activeTrainerId } from "@/lib/fit/options";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./PlanSummaryCard.module.scss";

/** The trainer's explanation of the current plan, and whether the AI or the standard generator made it. */
export function PlanSummaryCard() {
	const t = useT();
	const { state } = useFit();
	const { data: trainers } = useTrainers();
	if (!state.planSummary) return null;
	const trainer = trainerById(trainers, activeTrainerId(state));
	const name = trainer?.name ?? t("fit.ai.trainerFallback");

	return (
		<Card className={styles.root}>
			<div className={styles.top}>
				<p className={styles.eyebrow}>{t("fit.ai.planCard.eyebrow")}</p>
				<Badge>{t(state.planSource === "ai" ? "fit.ai.planCard.ai" : "fit.ai.planCard.standard")}</Badge>
			</div>
			<div className={styles.head}>
				{trainer && <Avatar name={trainer.name} src={trainer.pathToImage} size={40} />}
				<h2 className={styles.title}>{t("fit.ai.planCard.title", { name })}</h2>
			</div>
			<p className={styles.summary}>{state.planSummary}</p>
		</Card>
	);
}
