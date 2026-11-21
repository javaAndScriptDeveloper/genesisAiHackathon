"use client";

import { Badge } from "@/components/ui";
import { formatClock } from "@/lib/fit/dates";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { RecordMetric } from "@/lib/progress/records";
import type { RecordRow } from "@/lib/progress/recordsScreen";
import { useMassFormat } from "./useMassFormat";
import styles from "./ProgressRecords.module.scss";

export function RecordList({ rows }: { rows: RecordRow[] }) {
	const { t, locale } = useI18n();
	const fmt = useMassFormat();
	const k = "fit.progress.recordsScreen";
	const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	const date = (iso: string) => {
		const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
		return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(y, m - 1, d));
	};
	const value = (metric: RecordMetric, v: number): string => {
		switch (metric) {
			case "e1rm":
				return t(`${k}.approx`, { value: fmt.mass(v, 1) });
			case "weight":
				return fmt.load(v);
			case "reps":
				return `${nf.format(v)} ${t("fit.progress.report.unit.reps")}`;
			case "time":
				return formatClock(v);
		}
	};
	const gain = (metric: RecordMetric, g: number): string => {
		switch (metric) {
			case "e1rm":
				return t(`${k}.gain`, { value: fmt.mass(g, 1) });
			case "weight":
				return t(`${k}.gain`, { value: fmt.load(g) });
			case "reps":
				return t(`${k}.gain`, { value: nf.format(g) });
			case "time":
				return t(`${k}.gain`, { value: formatClock(g) });
		}
	};
	return (
		<ul className={styles.list}>
			{rows.map((r) => (
				<li key={`${r.key}`} className={styles.row}>
					<span className={styles.rowName}>
						{r.name}
						{r.isNew && <Badge tone="accent">{t(`${k}.new`)}</Badge>}
					</span>
					<strong className={styles.rowValue}>{value(r.metric, r.value)}</strong>
					<span className={styles.rowMeta}>
						{t(`${k}.metric.${r.metric}`)} · {date(r.date)}
					</span>
					<span className={styles.rowGain}>{gain(r.metric, r.gain)}</span>
				</li>
			))}
		</ul>
	);
}
