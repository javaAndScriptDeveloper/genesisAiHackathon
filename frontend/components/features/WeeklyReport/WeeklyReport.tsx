"use client";

import { CheckmarkCircle02Icon, Notification03Icon, PauseIcon, Target02Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ProgressInsights } from "@/components/features/ProgressInsights/ProgressInsights";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Badge, Button, Card, EmptyState, Icon, useToast } from "@/components/ui";
import { formatDay, formatMonthDay } from "@/lib/fit/dates";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useProgress, useUnits } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import { addDays } from "@/lib/progress/dates";
import { isValidReportWeek, weeklyReport, weeklyReportV2 } from "@/lib/progress/report";
import { adviceCopy, comparisonRows, goalOptions, improvementCopy } from "@/lib/progress/reportScreen";
import type { RecordMetric } from "@/lib/progress/records";
import styles from "./WeeklyReport.module.scss";

const UNIT: Record<RecordMetric, "kg" | "reps" | "s"> = { e1rm: "kg", weight: "kg", reps: "reps", time: "s" };

export function WeeklyReport({ week }: { week: string }) {
	const t = useT();
	const router = useRouter();
	const toast = useToast();
	const units = useUnits();
	const { today, dispatch } = useFit();
	const { history, ctx } = useProgress();
	const valid = isValidReportWeek(week, today);
	const report = useMemo(() => (valid ? weeklyReport(history, week) : null), [valid, history, week]);
	const v2 = useMemo(() => (valid ? weeklyReportV2(history, ctx, week) : null), [valid, history, ctx, week]);

	// Opening the report clears its "new" dot and card (the event's refId is that Monday).
	useEffect(() => {
		if (valid) dispatch({ type: "mark-seen", ids: [`report:${week}`], now: new Date().toISOString() });
	}, [valid, week, dispatch]);

	// A week before any logged workout has nothing to report (no zero verdicts for a new user).
	const noData = valid && !history.sessions.some((x) => x.date <= addDays(week, 6));

	if (!report || !v2 || noData) {
		return (
			<>
				<ScreenHeader title={t("fit.progress.report.title")} back="/progress" />
				<div className={styles.content}>
					<EmptyState title={noData ? t("fit.progress.report.noData") : t("fit.progress.report.notFound")} description={noData ? t("fit.progress.report.noDataBody") : t("fit.progress.report.notFoundBody")} action={<Button onClick={() => router.push("/progress", { transitionTypes: ["nav-back"] })}>{t("fit.progress.report.back")}</Button>} />
				</div>
			</>
		);
	}

	const { records, insight, nextWeek } = report;
	const { summary, credited, paused, improvement, advice, recommendedGoal, pushText } = v2;
	const rows = comparisonRows(summary, v2.previous);
	const options = goalOptions(recommendedGoal, ctx.weeklyGoal);
	const imp = improvement ? improvementCopy(improvement, history.exercises, (kg) => units.fmtMass(kg, 1)) : null;
	const adv = advice ? adviceCopy(advice, history.exercises, (kg) => units.fmtMass(kg, 1)) : null;
	const pick = (n: number) => {
		dispatch({ type: "set-weekly-goal", goal: n });
		toast.show(t("fit.progress.report.goalSaved", { n }), "success");
	};
	const state = paused ? "paused" : credited ? "credited" : "open";
	const name = (id: string): string => history.exercises.find((e) => e.id === id)?.name ?? id;
	const range = t("fit.progress.report.range", { from: formatMonthDay(week), to: formatMonthDay(addDays(week, 6)) });
	const planned = nextWeek.planned;

	return (
		<div className={styles.root}>
			<ScreenHeader title={t("fit.progress.report.title")} subtitle={range} back="/progress" />
			<div className={styles.content}>
				<section className={styles.push} aria-label={t("fit.progress.report.push")}>
					<span className={styles.pushIcon} aria-hidden="true"><Icon icon={Notification03Icon} size={18} /></span>
					<p className={styles.pushText}>{t(pushText.key, pushText.params)}</p>
				</section>

				<Card className={styles.hero} data-state={state}>
					<span className={styles.heroIcon} aria-hidden="true"><Icon icon={paused ? PauseIcon : credited ? CheckmarkCircle02Icon : Target02Icon} size={24} /></span>
					<div>
						<h2 className={styles.heroTitle}>{paused ? t("fit.progress.report.pausedTitle") : credited ? t("fit.progress.report.creditedTitle") : t("fit.progress.report.notCreditedTitle")}</h2>
						<p className={styles.p}>{paused ? t("fit.progress.report.pausedBody") : credited ? t("fit.progress.report.creditedBody") : t("fit.progress.report.notCreditedBody")}</p>
						<Badge tone={credited ? "success" : "neutral"}>{t("fit.progress.report.doneOfGoal", { done: pushText.params.done, goal: pushText.params.goal })}</Badge>
					</div>
				</Card>
				{summary.workouts === 0 && <p className={styles.quiet}>{t("fit.progress.report.empty")}</p>}

				<Card>
					<h3 className={styles.h3}>{t("fit.progress.report.compare")}</h3>
					<table className={styles.table}>
						<thead>
							<tr>
								<th scope="col">{t("fit.progress.report.col.metric")}</th>
								<th scope="col">{t("fit.progress.report.col.now")}</th>
								<th scope="col">{t("fit.progress.report.col.before")}</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => (
								<tr key={r.metric}>
									<th scope="row">{t(`fit.progress.report.metric.${r.metric}`)}</th>
									<td>
										<strong>{r.now}</strong>
										<span className={styles.delta} data-tone={r.tone}>{t(`fit.progress.report.delta.${r.direction}`, { n: Math.abs(r.delta) })}</span>
									</td>
									<td>{r.before}</td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>

				<Card>
					<h3 className={styles.h3}>{t("fit.progress.report.improvement")}</h3>
					<p className={styles.p}>{imp ? t(imp.key, imp.params) : t("fit.progress.report.noImprovement")}</p>
					{adv && (
						<>
							<h3 className={styles.h3b}>{t("fit.progress.report.advice")}</h3>
							<p className={styles.p}>{t(adv.key, adv.params)}</p>
						</>
					)}
				</Card>

				<Card>
					<h3 className={styles.h3}>{t("fit.progress.report.goalTitle")}</h3>
					<p className={styles.p}>{t("fit.progress.report.goalHint")}</p>
					<div className={styles.goals} role="group" aria-label={t("fit.progress.report.goalTitle")}>
						{options.map((o) => (
							<button key={o.value} type="button" className={styles.goal} aria-pressed={o.selected} data-selected={o.selected || undefined} onClick={() => pick(o.value)}>
								<strong>{o.value}</strong>
								<span>{t("fit.progress.report.goalOption", { n: o.value })}</span>
								{o.recommended && <Badge tone="accent" className={styles.rec}>{t("fit.progress.report.recommended")}</Badge>}
							</button>
						))}
					</div>
				</Card>

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

				{insight && <ProgressInsights insights={[insight]} />}

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
