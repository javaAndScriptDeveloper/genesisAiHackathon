"use client";

import { useRef } from "react";
import { ChartBarLineIcon } from "@hugeicons/core-free-icons";
import { Badge, Button, Card, EmptyState, Icon, Table, type Column } from "@/components/ui";
import { fromISO } from "@/lib/fit/dates";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { retentionDays, type CohortMetric, type CohortRow } from "@/lib/insights/cohorts";
import { DashboardChart } from "./DashboardChart";
import styles from "./AnalyticsDashboard.module.scss";

const columns: CohortMetric[] = ["d1", "d7", "d14", "d30", "activation", "paid"];
const ticks = [100, 75, 50, 25, 0];

export function CohortsPanel({ cohorts, onShowDemo }: { cohorts: CohortRow[] | null; onShowDemo: () => void }) {
	const { t, locale } = useI18n();
	const heading = useRef<HTMLHeadingElement>(null);
	const date = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
	const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
	const number = new Intl.NumberFormat(locale);
	const mature = cohorts?.filter((cohort) => cohort.counts.d30 !== null) ?? [];
	const comparableUsers = mature.reduce((sum, cohort) => sum + cohort.size, 0);
	const tableColumns: Column<CohortRow>[] = [
		{
			key: "week",
			header: t("analytics.cohorts.week"),
			width: "23%",
			render: ({ start, end }) => date.formatRange(fromISO(start), fromISO(end)),
		},
		{ key: "size", header: t("analytics.cohorts.size"), width: "10%", align: "right", render: (row) => number.format(row.size) },
		...columns.map((metric): Column<CohortRow> => ({
			key: metric,
			header: t(`analytics.cohorts.metrics.${metric}`),
			width: metric === "activation" || metric === "paid" ? "15.5%" : "9%",
			align: "right",
			render: (row) => {
				const count = row.counts[metric];
				if (count === null) return <span aria-label={t("analytics.cohorts.pending")}>—</span>;
				const rate = count / row.size;
				const heat = rate >= 0.35 ? "high" : rate >= 0.18 ? "medium" : "low";
				return (
					<span className={styles.cohortCell} data-heat={heat} title={t("analytics.cohorts.fraction", { count: number.format(count), total: number.format(row.size) })}>
						{percent.format(rate)}
					</span>
				);
			},
		})),
	];

	return (
		<section id="cohorts" className={styles.cohorts} aria-labelledby="cohorts-title">
			<header className={styles.activityTitle}>
				<h2 id="cohorts-title" ref={heading} tabIndex={-1}>{t("analytics.cohorts.title")}</h2>
				{cohorts && <Badge tone="accent" className={styles.sourceBadge}>{t("analytics.activity.demoBadge")}</Badge>}
			</header>
			{cohorts ? (
				<>
					<p>{t("analytics.cohorts.detail")}</p>
					<div className={styles.cohortGrid}>
						<div className={styles.cohortTable}>
							<Table columns={tableColumns} rows={cohorts} getRowKey={(row) => row.start} emptyTitle={t("analytics.cohorts.empty")} />
						</div>
						<Card className={styles.panel}>
							<header className={styles.panelHeading}>
								<div>
									<h3>{t("analytics.cohorts.retention")}</h3>
									<p>{t("analytics.cohorts.comparable", { users: number.format(comparableUsers) })}</p>
								</div>
								<span className={styles.panelIcon}><Icon icon={ChartBarLineIcon} size={21} /></span>
							</header>
							<DashboardChart
								label={t("analytics.cohorts.retention")}
								max={100}
								ticks={ticks.map((value) => ({ value, label: percent.format(value / 100) }))}
								points={retentionDays.map((day) => {
									const count = mature.reduce((sum, cohort) => sum + (cohort.counts[`d${day}`] ?? 0), 0);
									const rate = comparableUsers ? count / comparableUsers : 0;
									const label = t(`analytics.cohorts.metrics.d${day}`);
									return {
										id: label, label, tick: label, value: rate * 100,
										values: [
											{ label: t("analytics.cohorts.retention"), amount: percent.format(rate) },
											{ label: t("analytics.cohorts.returned"), amount: number.format(count) },
										],
									};
								})}
							/>
						</Card>
					</div>
					<p className={styles.cohortNote}>{t("analytics.cohorts.definitions")}</p>
				</>
			) : (
				<Card className={styles.panel}>
					<EmptyState
						icon={ChartBarLineIcon}
						title={t("analytics.cohorts.empty")}
						description={t("analytics.cohorts.emptyDetail")}
						action={<Button size="sm" variant="secondary" onClick={() => { onShowDemo(); heading.current?.focus({ preventScroll: true }); }}>{t("analytics.activity.showDemo")}</Button>}
					/>
				</Card>
			)}
		</section>
	);
}
