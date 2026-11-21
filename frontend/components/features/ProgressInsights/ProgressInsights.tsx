"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import { insightCopy } from "@/lib/progress/insightCopy";
import type { Insight } from "@/lib/progress/insights";
import styles from "./ProgressInsights.module.scss";

interface ProgressInsightsProps {
	insights: Insight[];
	/** Shown when there are no insights yet. */
	fallback?: string;
	/** Optional trailing action, e.g. a Share button. */
	action?: ReactNode;
}

export function ProgressInsights({ insights, fallback, action }: ProgressInsightsProps) {
	const t = useT();
	return (
		<Card>
			<h3 className={styles.h3}>{t("fit.progress.insights.title")}</h3>
			{insights.length === 0 ? (
				<p className={styles.p}>{fallback}</p>
			) : (
				<ul className={styles.list}>
					{insights.map((i) => {
						const c = insightCopy(i, t);
						return (
							<li key={i.id} className={styles.item}>
								<strong className={styles.title}>{c.title}</strong>
								<span className={styles.next}>{t("fit.progress.insights.next", { text: c.next })}</span>
							</li>
						);
					})}
				</ul>
			)}
			{action}
		</Card>
	);
}
