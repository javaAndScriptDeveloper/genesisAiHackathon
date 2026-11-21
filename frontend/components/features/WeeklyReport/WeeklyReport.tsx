"use client";

import { Calendar03Icon, Clock01Icon, Target02Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ProgressInsights } from "@/components/features/ProgressInsights/ProgressInsights";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Stat } from "@/components/features/Stat/Stat";
import { Badge, Button, Card, EmptyState, Icon } from "@/components/ui";
import { formatDay, formatMonthDay } from "@/lib/fit/dates";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useProgressAnalytics } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import { addDays } from "@/lib/progress/dates";
import { isValidReportWeek, weeklyReport } from "@/lib/progress/report";
import type { RecordMetric } from "@/lib/progress/records";
import styles from "./WeeklyReport.module.scss";

const UNIT: Record<RecordMetric, "kg" | "reps" | "s"> = { e1rm: "kg", weight: "kg", reps: "reps", time: "s" };

export function WeeklyReport({ week }: { week: string }) {
	const t = useT();
	const router = useRouter();
	const { today } = useFit();
	const { history } = useProgressAnalytics();
	const valid = isValidReportWeek(week, today);
	const report = useMemo(() => (valid ? weeklyReport(history, week) : null), [valid, history, week]);

	if (!report) {
		return (
			<>
				<ScreenHeader title={t("fit.progress.report.title")} back="/progress" />
				<div className={styles.content}>
					<EmptyState title={t("fit.progress.report.notFound")} description={t("fit.progress.report.notFoundBody")} action={<Button onClick={() => router.push("/progress", { transitionTypes: ["nav-back"] })}>{t("fit.progress.report.back")}</Button>} />
				</div>
			</>
		);
	}

	const { summary, previous, records, insight, nextWeek } = report;
	const diff = (now: number, before: number): string => (now === before ? t("fit.progress.report.same") : `${now > before ? "+" : "−"}${Math.abs(now - before)}`);
	const hint = (now: number, before: number): string => t("fit.progress.report.vsPrev", { diff: diff(now, before) });
	const name = (id: string): string => history.exercises.find((e) => e.id === id)?.name ?? id;
	const range = t("fit.progress.report.range", { from: formatMonthDay(week), to: formatMonthDay(addDays(week, 6)) });
	const planned = nextWeek.planned;

	return (
		<div className={styles.root}>
			<ScreenHeader title={t("fit.progress.report.title")} subtitle={range} back="/progress" />
			<div className={styles.content}>
				{summary.workouts === 0 && <p className={styles.quiet}>{t("fit.progress.report.empty")}</p>}
				<div className={styles.grid}>
					<Stat label={t("fit.progress.report.workouts")} value={summary.workouts} hint={hint(summary.workouts, previous.workouts)} icon={<Icon icon={Calendar03Icon} size={14} />} />
					<Stat label={t("fit.progress.report.minutes")} value={summary.minutes} hint={hint(summary.minutes, previous.minutes)} icon={<Icon icon={Clock01Icon} size={14} />} />
					<Stat label={t("fit.progress.report.adherence")} value={summary.adherencePct === null ? "–" : `${summary.adherencePct}%`} hint={summary.adherencePct === null || previous.adherencePct === null ? t("fit.progress.report.noPrev") : hint(summary.adherencePct, previous.adherencePct)} icon={<Icon icon={Target02Icon} size={14} />} />
				</div>

				<Card>
					<h3 className={styles.h3}>{t("fit.progress.report.records")}</h3>
					{records.length === 0 ? <p className={styles.p}>{t("fit.progress.report.noRecords")}</p> : (
						<ul className={styles.list}>
							{records.map((r) => (
								<li key={`${r.exerciseId}:${r.metric}:${r.date}`} className={styles.record}>
									<span><strong>{name(r.exerciseId)}</strong><span className={styles.sub}>{formatDay(r.date)}</span></span>
									<Badge tone="accent">{t("fit.progress.report.recordValue", { value: r.value, unit: t(`fit.progress.report.unit.${UNIT[r.metric]}`) })}</Badge>
								</li>
							))}
						</ul>
					)}
				</Card>

				{insight && <ProgressInsights insights={[insight]} fallback="" />}

				<Card>
					<h3 className={styles.h3}>{t("fit.progress.report.next")}</h3>
					{planned === 0 ? <p className={styles.p}>{t("fit.progress.report.nextEmpty")}</p> : (
						<ul className={styles.days}>
							{nextWeek.days.map((d, i) => (
								<li key={d.date} className={styles.day} data-type={d.type} data-none={d.status === "none" || undefined}>
									<span>{t(`fit.progress.weekdays.${i}`).slice(0, 3)}</span>
									{d.status === "none" ? <span className={styles.none} aria-hidden="true" /> : (
										<>
											<span className={styles.marker} data-type={d.type} aria-hidden="true" />
											<span className={styles.srOnly}>{d.type === "workout" ? t("fit.progress.report.workoutDay") : t("fit.progress.report.restDay")}</span>
										</>
									)}
								</li>
							))}
						</ul>
					)}
					{planned > 0 && (
						<ul className={styles.legend} aria-hidden="true">
							<li><span className={styles.marker} data-type="workout" />{t("fit.progress.report.workoutDay")}</li>
							<li><span className={styles.marker} data-type="rest" />{t("fit.progress.report.restDay")}</li>
						</ul>
					)}
				</Card>
			</div>
		</div>
	);
}
