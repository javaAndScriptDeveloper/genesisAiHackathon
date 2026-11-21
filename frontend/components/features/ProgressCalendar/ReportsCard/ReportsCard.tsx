"use client";

import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { formatMonthDay } from "@/lib/fit/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ReportsCard.module.scss";

/** Recent weekly report weeks (Mondays) linking to the full report. Hidden when there are none. */
export function ReportsCard({ weeks }: { weeks: string[] }) {
	const t = useT();
	if (weeks.length === 0) return null;
	return (
		<Card>
			<h3 className={styles.title}>{t("fit.progress.reports.title")}</h3>
			<ul className={styles.list}>
				{weeks.slice(0, 4).map((w) => (
					<li key={w}>
						<Link href={`/progress/week/${w}`} transitionTypes={["nav-forward"]} className={styles.record}>
							<strong>{t("fit.progress.reports.week", { date: formatMonthDay(w) })}</strong>
							<Badge>{t("fit.progress.reports.open")}</Badge>
						</Link>
					</li>
				))}
			</ul>
		</Card>
	);
}
