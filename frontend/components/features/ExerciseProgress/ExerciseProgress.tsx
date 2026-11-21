"use client";

import { useMemo } from "react";
import { ProgressInsights } from "@/components/features/ProgressInsights/ProgressInsights";
import { LineChart } from "@/components/features/Charts/Charts";
import { Badge, Card } from "@/components/ui";
import { formatMonthDay } from "@/lib/fit/dates";
import { useProgressAnalytics } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseProgressView } from "@/lib/progress/exerciseView";
import { exerciseInsight } from "@/lib/progress/insights";
import type { RecordMetric } from "@/lib/progress/records";
import styles from "./ExerciseProgress.module.scss";

const UNIT: Record<RecordMetric, "kg" | "reps" | "s"> = { e1rm: "kg", weight: "kg", reps: "reps", time: "s" };

export function ExerciseProgress({ exerciseId }: { exerciseId: string }) {
	const t = useT();
	const { history } = useProgressAnalytics();
	const view = useMemo(() => exerciseProgressView(history, exerciseId), [history, exerciseId]);
	const insight = useMemo(() => exerciseInsight(history, exerciseId), [history, exerciseId]);
	const name = history.exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;
	const { metric } = view;

	if (!metric || view.points.length < 2 || view.best === null) {
		return (
			<Card>
				<h3 className={styles.h3}>{t("fit.progress.exercise.title")}</h3>
				<p className={styles.p}>{t("fit.progress.exercise.empty")}</p>
			</Card>
		);
	}

	const unit = t(`fit.progress.report.unit.${UNIT[metric]}`);
	return (
		<section className={styles.root}>
			<Card>
				<h3 className={styles.h3}>{t("fit.progress.exercise.title")}</h3>
				<LineChart data={view.points.map((p) => ({ label: formatMonthDay(p.date), value: p.value }))} label={t("fit.progress.exercise.chart", { name })} unit={` ${unit}`} />
				<p className={styles.best}>{t("fit.progress.exercise.best", { value: view.best, unit })}</p>
				{view.records.length > 0 && (
					<>
						<h4 className={styles.h4}>{t("fit.progress.exercise.records")}</h4>
						<ul className={styles.list}>
							{view.records.map((r) => (
								<li key={`${r.metric}:${r.date}:${r.sessionId}`} className={styles.record}>
									<span className={styles.date}>{formatMonthDay(r.date)}</span>
									<Badge tone="accent">{t("fit.progress.report.recordValue", { value: r.value, unit })}</Badge>
								</li>
							))}
						</ul>
					</>
				)}
			</Card>
			{insight && <ProgressInsights insights={[insight]} />}
		</section>
	);
}
