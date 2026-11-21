"use client";

import { ProgressRing, Button } from "@/components/ui";
import { formatClock } from "@/lib/fit/dates";
import { getExercise } from "@/lib/fit/exercises";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Workout.module.scss";

export function RestView({ onAdjust }: { onAdjust: () => void }) {
	const t = useT();
	const { state, dispatch } = useFit();
	const a = state.active;
	if (!a) return null;
	const block = a.exercises[a.index];
	const moreInBlock = !!block && block.sets.some((s) => !s.done);
	const upcomingBlock = moreInBlock ? block : a.exercises.find((b, i) => i > a.index && !b.skipped && b.sets.some((s) => !s.done)) ?? a.exercises.find((b) => !b.skipped && b.sets.some((s) => !s.done));
	const upSetIndex = upcomingBlock ? upcomingBlock.sets.findIndex((s) => !s.done) : -1;
	const upSet = upcomingBlock?.sets[upSetIndex];
	return (
		<div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t("fit.workout.rest")}>
			<p className={styles.restLabel}>{t("fit.workout.rest")}</p>
			<ProgressRing value={a.restTotal ? (a.restLeft / a.restTotal) * 100 : 0} size={200} stroke={12} label={t("fit.workout.rest")}>
				<span className={styles.restTime} aria-live="off">{formatClock(a.restLeft)}</span>
			</ProgressRing>
			<div className={styles.restActions}>
				<Button variant="secondary" className={styles.onDark} onClick={() => dispatch({ type: "add-rest", seconds: 30 })}>{t("fit.workout.addRest")}</Button>
				<Button size="lg" onClick={() => dispatch({ type: "skip-rest" })}>{t("fit.workout.skipRest")}</Button>
			</div>
			{upcomingBlock && upSet && (
				<div className={styles.nextUp}>
					<span>{t("fit.workout.upNext")}</span>
					<strong>{getExercise(upcomingBlock.exerciseId).name}</strong>
					<span>
						{t("fit.workout.setOf", { n: upSetIndex + 1, total: upcomingBlock.sets.length })} · {upSet.target}
						{getExercise(upcomingBlock.exerciseId).timed ? " s" : ` ${t("fit.common.reps")}`}
						{upSet.targetWeight ? ` · ${upSet.targetWeight} kg` : ""}
					</span>
				</div>
			)}
			<Button variant="ghost" className={styles.onDarkGhost} onClick={onAdjust}>{t("fit.workout.tooHardRest")}</Button>
		</div>
	);
}
