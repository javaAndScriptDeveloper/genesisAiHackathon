"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { setRecords } from "@/lib/progress/records";
import type { History } from "@/lib/progress/types";
import { useMassFormat } from "./useMassFormat";
import styles from "./ProgressRecords.module.scss";

/** Heaviest weight for exactly 5, 8 and 10 reps. */
export function SetRecords({ history, exerciseId }: { history: History; exerciseId: string }) {
	const { t } = useI18n();
	const fmt = useMassFormat();
	const records = useMemo(() => setRecords(history, exerciseId), [history, exerciseId]);
	const k = "fit.progress.recordsScreen";
	return (
		<section className={styles.block} aria-labelledby={`sr-${exerciseId}`}>
			<h4 id={`sr-${exerciseId}`} className={styles.h4}>
				{t(`${k}.setRecordsTitle`)}
			</h4>
			<p className={styles.hint}>{t(`${k}.setRecordsHint`)}</p>
			{records.length === 0 ? (
				<p className={styles.hint}>{t(`${k}.setRecordsEmpty`)}</p>
			) : (
				<ul className={styles.sets}>
					{records.map((r) => (
						<li key={r.reps} className={styles.set}>
							<span className={styles.setLabel}>{t(`${k}.setRecordsRepsLabel`, { reps: r.reps })}</span>
							<strong>{fmt.load(r.weightKg)}</strong>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
