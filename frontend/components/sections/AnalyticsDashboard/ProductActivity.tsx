"use client";

import { Activity01Icon, ChartBarLineIcon, CheckmarkCircle02Icon, Dumbbell01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { useState, useSyncExternalStore } from "react";
import { Badge, Card, EmptyState, Icon, SegmentedControl, Skeleton } from "@/components/ui";
import { fromISO } from "@/lib/fit/dates";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { summarizeActivity, type Period } from "@/lib/insights/activity";
import { eventNames, readBrowserEvents, subscribeBrowserEvents } from "@/lib/insights/browserEvents";
import styles from "./AnalyticsDashboard.module.scss";

const periodOptions: Period[] = ["week", "month", "quarter"];
const noServerSnapshot = () => null;

export function ProductActivity() {
	const { locale, t } = useI18n();
	const [period, setPeriod] = useState<Period>("month");
	const snapshot = useSyncExternalStore(subscribeBrowserEvents, readBrowserEvents, noServerSnapshot);
	const data = snapshot?.available ? summarizeActivity(snapshot.events, period, new Date()) : null;
	const formatDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
	const formatNumber = new Intl.NumberFormat(locale);
	const metrics = [
		{ id: "onboarding", value: data?.counts.get("onboarding_completed"), icon: UserAdd01Icon },
		{ id: "starts", value: data?.counts.get("workout_started"), icon: Dumbbell01Icon },
		{ id: "completed", value: data?.completed, icon: CheckmarkCircle02Icon },
		{ id: "quality", value: data?.quality, icon: Activity01Icon },
	];
	const counts = eventNames
		.map((event) => ({ event, count: data?.counts.get(event) ?? 0 }))
		.sort((left, right) => right.count - left.count);
	const busiest = counts[0]?.count ?? 0;
	const step = Math.max(1, Math.ceil(Math.max(...(data?.buckets.map((bucket) => bucket.count) ?? [0])) / 3));
	const ceiling = step * 3;
	const ticks = [ceiling, step * 2, step, 0];

	return (
		<section id="product-activity" className={styles.activity} aria-labelledby="activity-title" aria-busy={!snapshot}>
			<header className={styles.activityHeader}>
				<div>
					<div className={styles.activityTitle}>
						<h2 id="activity-title">{t("analytics.activity.title")}</h2>
						<Badge className={styles.sourceBadge}>{t("analytics.activity.badge")}</Badge>
					</div>
					<p>{t("analytics.activity.subtitle")}</p>
				</div>
				<SegmentedControl label={t("analytics.activity.period")} options={periodOptions.map((id) => ({ id, label: t(`analytics.activity.periods.${id}`) }))} value={period} onChange={setPeriod} />
			</header>

			<div className={styles.metrics} aria-live="polite">
				{metrics.map(({ id, value, icon }) => (
					<Card key={id} className={styles.metric}>
						<div className={styles.metricLabel}>
							<span className={styles.metricIcon}><Icon icon={icon} size={18} /></span>
							<h3>{t(`analytics.activity.metrics.${id}`)}</h3>
						</div>
						{snapshot ? <strong>{value === undefined ? "—" : formatNumber.format(value)}</strong> : <Skeleton width="5rem" height="3.2rem" />}
						<p>{t(`analytics.activity.details.${id}`)}</p>
					</Card>
				))}
			</div>

			<div className={styles.panels}>
				<Card className={styles.panel}>
					<header className={styles.panelHeading}>
						<div>
							<h3>{t("analytics.activity.chartTitle")}</h3>
							<p>{data ? t("analytics.activity.total", { count: formatNumber.format(data.total) }) : t("analytics.activity.chartDetail")}</p>
						</div>
						<span className={styles.panelIcon}><Icon icon={ChartBarLineIcon} size={21} /></span>
					</header>
					{!snapshot ? <Skeleton height="20rem" /> : data?.total ? (
						<div className={styles.activityChart}>
							<div className={styles.chart}>
								<div className={styles.axis} aria-hidden>
									{ticks.map((value) => <span key={value}>{formatNumber.format(value)}</span>)}
								</div>
								<div className={styles.plot}>
									<div className={styles.gridlines} aria-hidden>{ticks.map((value) => <i key={value} />)}</div>
									<ul className={styles.bars} aria-label={t("analytics.activity.chartTitle")}>
										{data.buckets.map(({ from, to, count }) => {
											const startLabel = formatDate.format(fromISO(from));
											const date = from === to ? startLabel : `${startLabel} – ${formatDate.format(fromISO(to))}`;
											const description = t("analytics.activity.chartValue", { date, count: formatNumber.format(count) });
											return (
												<li key={from}>
													<span className={styles.chartBar} style={{ height: `${100 * count / ceiling}%` }} title={description}>
														<span className={styles.srOnly}>{description}</span>
													</span>
													<span className={styles.tickLabel} aria-hidden>{startLabel}</span>
												</li>
											);
										})}
									</ul>
								</div>
							</div>
						</div>
					) : (
						<div className={styles.chartEmpty}>
							<EmptyState
								icon={Activity01Icon}
								title={t(snapshot.available ? "analytics.activity.empty" : "analytics.activity.unavailable")}
								description={t(snapshot.available ? "analytics.activity.emptyDetail" : "analytics.activity.unavailableDetail")}
							/>
						</div>
					)}
				</Card>
				<Card className={styles.panel}>
					<header className={styles.panelHeading}>
						<div>
							<h3>{t("analytics.activity.eventsTitle")}</h3>
							<p>{t("analytics.activity.eventsDetail")}</p>
						</div>
					</header>
					{snapshot ? (
						<dl className={styles.eventRows}>
							{counts.map(({ event, count }) => (
								<div key={event}>
									<dt>{t(`analytics.activity.events.${event}`)}</dt>
									<dd>
										<span className={styles.eventTrack} aria-hidden>
											<span style={{ width: `${busiest ? 100 * count / busiest : 0}%` }} />
										</span>
										<span>{snapshot.available ? formatNumber.format(count) : "—"}</span>
									</dd>
								</div>
							))}
						</dl>
					) : <Skeleton height="20rem" />}
				</Card>
			</div>
			<details className={styles.method}>
				<summary>{t("analytics.activity.coverage")}</summary>
				<ul className={styles.notes}>
					{["retention", "workouts", "subscription", "cohorts"].map((id) => <li key={id}>{t(`analytics.activity.notes.${id}`)}</li>)}
				</ul>
			</details>
		</section>
	);
}
