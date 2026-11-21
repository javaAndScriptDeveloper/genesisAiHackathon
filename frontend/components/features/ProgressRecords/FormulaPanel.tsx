"use client";

import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { useMemo } from "react";
import { Icon } from "@/components/ui";
import { useUnits } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import { bestFormulaSet, formulaParams } from "@/lib/progress/recordsScreen";
import type { History } from "@/lib/progress/types";
import styles from "./ProgressRecords.module.scss";

/** "Where this number comes from": Brzycki shown on the best qualifying set. */
export function FormulaPanel({ history, exerciseId }: { history: History; exerciseId: string }) {
	const t = useT();
	const units = useUnits();
	const example = useMemo(() => bestFormulaSet(history, exerciseId), [history, exerciseId]);
	const k = "fit.progress.recordsScreen";
	return (
		<div className={styles.formula}>
			<h4 className={styles.formulaTitle}>
				<Icon icon={InformationCircleIcon} size={16} />
				{t(`${k}.sourceTitle`)}
			</h4>
			{example ? (
				<>
					<p className={styles.hint}>{t(`${k}.sourceBody`)}</p>
					<p className={styles.example}>{t(`${k}.sourceExample`, formulaParams(example, (kg, d) => units.fmtMass(kg, d)))}</p>
				</>
			) : (
				<p className={styles.hint}>{t(`${k}.sourceNone`)}</p>
			)}
		</div>
	);
}
