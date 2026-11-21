"use client";

import { ExerciseVideo } from "@/components/features/ExerciseVideo/ExerciseVideo";
import { Button } from "@/components/ui";
import { formatClock } from "@/lib/fit/dates";
import { getExercise } from "@/lib/fit/exercises";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useUnits } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Workout.module.scss";

// Rest is its own full-colour moment: giant countdown, two pill actions, then a preview (with video) of what comes next.
export function RestView({ onAdjust }: { onAdjust: () => void }) {
	const t = useT();
	const { state, dispatch } = useFit();
	const u = useUnits();
	const a = state.active;
	if (!a) return null;
	const block = a.exercises[a.index];
	const moreInBlock = !!block && block.sets.some((s) => !s.done);
	const upcomingIndex = moreInBlock ? a.index : a.exercises.findIndex((b, i) => i > a.index && !b.skipped && b.sets.some((s) => !s.done));
	const resolvedIndex = upcomingIndex >= 0 ? upcomingIndex : a.exercises.findIndex((b) => !b.skipped && b.sets.some((s) => !s.done));
	const upcomingBlock = a.exercises[resolvedIndex];
	const upSetIndex = upcomingBlock ? upcomingBlock.sets.findIndex((s) => !s.done) : -1;
	const upSet = upcomingBlock?.sets[upSetIndex];
	const upExercise = upcomingBlock ? getExercise(upcomingBlock.exerciseId) : undefined;
	const pct = a.restTotal ? (a.restLeft / a.restTotal) * 100 : 0;

	return (
		<div className={`${styles.overlay} ${styles.restScreen}`} role="dialog" aria-modal="true" aria-label={t("fit.workout.rest")}>
			<div className={styles.restTop}>
				<p className={styles.restLabel}>{t("fit.workout.rest")}</p>
				<p className={styles.restTime} aria-live="off">{formatClock(a.restLeft)}</p>
				<span className={styles.restBar} role="progressbar" aria-label={t("fit.workout.rest")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
					<span style={{ width: `${pct}%` }} />
				</span>
				<div className={styles.restActions}>
					<button type="button" className={styles.pillGhost} onClick={() => dispatch({ type: "add-rest", seconds: 30 })}>{t("fit.workout.addRest")}</button>
					<button type="button" className={styles.pillSolid} onClick={() => dispatch({ type: "skip-rest" })}>{t("fit.workout.skipRest")}</button>
				</div>
			</div>

			{upcomingBlock && upSet && upExercise && (
				<div className={styles.nextUp}>
					<span className={styles.nextEyebrow}>
						{t("fit.workout.upNext")} · {resolvedIndex + 1}/{a.exercises.length}
					</span>
					<strong>{upExercise.name}</strong>
					<span>
						{t("fit.workout.setOf", { n: upSetIndex + 1, total: upcomingBlock.sets.length })} · {upSet.target}
						{upExercise.timed ? " s" : ` ${t("fit.common.reps")}`}
						{upSet.targetWeight ? ` · ${u.fmtLoad(upSet.targetWeight)}` : ""}
					</span>
					<ExerciseVideo exercise={upExercise} compact />
				</div>
			)}
			<Button variant="ghost" onDark onClick={onAdjust}>{t("fit.workout.tooHardRest")}</Button>
		</div>
	);
}
