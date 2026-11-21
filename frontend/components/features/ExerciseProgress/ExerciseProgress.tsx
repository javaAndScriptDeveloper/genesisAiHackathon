"use client";

import { useMemo } from "react";
import { ProgressInsights } from "@/components/features/ProgressInsights/ProgressInsights";
import Link from "next/link";
import { ExerciseTrend } from "@/components/features/ProgressRecords/ExerciseTrend";
import { SetRecords } from "@/components/features/ProgressRecords/SetRecords";
import { Badge, Card } from "@/components/ui";
import { formatMonthDay } from "@/lib/fit/dates";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useProgressAnalytics, useUnits } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseProgressView } from "@/lib/progress/exerciseView";
import { exerciseInsight } from "@/lib/progress/insights";
import type { RecordMetric } from "@/lib/progress/records";
import styles from "./ExerciseProgress.module.scss";

const UNIT: Record<RecordMetric, "kg" | "reps" | "s"> = { e1rm: "kg", weight: "kg", reps: "reps", time: "s" };

export function ExerciseProgress({ exerciseId }: { exerciseId: string }) {
	const t = useT();
	const { history } = useProgressAnalytics();
	const { today } = useFit();
	const units = useUnits();
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

	const isMass = UNIT[metric] === "kg";
	const unit = isMass ? units.unit : t(`fit.progress.report.unit.${UNIT[metric]}`);
	const show = (v: number) => (isMass ? units.mass(v, 1) : v);
	const prefix = metric === "e1rm" ? "≈ " : "";
	return (
		<section className={styles.root}>
			<Card>
				<h3 className={styles.h3}>{t("fit.progress.exercise.title")}</h3>
				<ExerciseTrend history={history} exerciseId={exerciseId} today={today} name={name} />
				<p className={styles.best}>{t("fit.progress.exercise.best", { value: `${prefix}${show(view.best)}`, unit })}</p>
				{metric === "e1rm" && <p className={styles.p}>{t("fit.progress.exercise.estimateNote")}</p>}
				<SetRecords history={history} exerciseId={exerciseId} />
				{view.records.length > 0 && (
					<>
						<h4 className={styles.h4}>{t("fit.progress.exercise.records")}</h4>
						<ul className={styles.list}>
							{view.records.map((r) => (
								<li key={`${r.metric}:${r.date}:${r.sessionId}`} className={styles.record}>
									<span className={styles.date}>{formatMonthDay(r.date)}</span>
									<Badge tone="accent">{t("fit.progress.report.recordValue", { value: `${prefix}${show(r.value)}`, unit })}</Badge>
								</li>
							))}
						</ul>
					</>
				)}
				<Link href={`/progress/records?exercise=${encodeURIComponent(exerciseId)}`} className={styles.link}>
					{t("fit.progress.recordsScreen.allRecords")}
				</Link>
			</Card>
			{insight && <ProgressInsights insights={[insight]} />}
		</section>
	);
}
