"use client";

import { useMemo } from "react";
import { InteractiveChart } from "@/components/features/InteractiveChart/InteractiveChart";
import { PremiumGate, usePremium } from "@/components/features/PremiumGate/PremiumGate";
import { useUnits } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseSeries } from "@/lib/progress/records";
import { isLockedPeriod, plottedMetric } from "@/lib/progress/recordsScreen";
import type { History, IsoDate } from "@/lib/progress/types";

/** Interactive chart of the main metric of one exercise (e1RM for weighted), in the user's units. */
export function ExerciseTrend({ history, exerciseId, today, name }: { history: History; exerciseId: string; today: IsoDate; name: string }) {
	const t = useT();
	const units = useUnits();
	const premium = usePremium();
	const metric = plottedMetric(history, exerciseId);
	const series = useMemo(() => exerciseSeries(history, exerciseId), [history, exerciseId]);
	const isMass = metric === "e1rm" || metric === "weight";
	const points = useMemo(() => (isMass ? series.map((p) => ({ date: p.date, value: units.mass(p.value, 1) })) : series), [series, isMass, units]);
	if (!metric) return null;
	const unit = isMass ? units.unit : t(`fit.progress.report.unit.${metric === "reps" ? "reps" : "s"}`);
	return (
		<InteractiveChart
			points={points}
			unit={unit}
			label={t("fit.progress.recordsScreen.chartLabel", { name, metric: t(`fit.progress.recordsScreen.metric.${metric}`) })}
			today={today}
			valuePrefix={metric === "e1rm" ? "≈ " : ""}
			isLocked={(p) => isLockedPeriod(p, premium)}
			lockedContent={<PremiumGate title={t("fit.progress.chart.lockedTitle")} body={t("fit.progress.chart.lockedBody")} source="records" >{null}</PremiumGate>}
		/>
	);
}
