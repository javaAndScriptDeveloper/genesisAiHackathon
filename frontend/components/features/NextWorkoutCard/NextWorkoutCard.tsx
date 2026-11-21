"use client";

import { Clock01Icon, PlayIcon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { MuscleMap } from "@/components/features/MuscleMap/MuscleMap";
import { Button, Card, Icon, SportIcon } from "@/components/ui";
import { formatDay } from "@/lib/fit/dates";
import { kcalFor } from "@/lib/fit/calories";
import { musclesOf } from "@/lib/fit/muscles";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useStartWorkout } from "@/lib/fit/store/hooks";
import type { PlannedWorkout } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./NextWorkoutCard.module.scss";

// The one workout to do next: what it trains (body map), how long, roughly how much energy, and a single big action.
export function NextWorkoutCard({ workout }: { workout: PlannedWorkout }) {
	const t = useT();
	const router = useRouter();
	const { state, today } = useFit();
	const start = useStartWorkout();
	const muscles = musclesOf(workout.exercises);
	const kcal = kcalFor(workout.exercises.map((b) => b.exerciseId), state.profile?.weightKg ?? 70, workout.durationMin);
	return (
		<Card className={styles.card}>
			<div className={styles.top}>
				<div className={styles.text}>
					<p className={styles.eyebrow}>{workout.date === today ? t("fit.training.today") : t("fit.training.upNext", { day: formatDay(workout.date) })}</p>
					<h2 className={styles.title}>{workout.title}</h2>
					<div className={styles.chips}>
						<span className={styles.chip}>
							<Icon icon={Clock01Icon} size={14} />
							{workout.durationMin} {t("fit.common.minShort")}
						</span>
						<span className={styles.chip}>
							<SportIcon name="flame" size={14} />
							{kcal} kcal
						</span>
						<span className={styles.chip}>{t("fit.session.level", { n: workout.difficulty })}</span>
					</div>
				</div>
				{muscles.length > 0 && <MuscleMap muscles={muscles} variant="pair" label={t("fit.session.targets")} />}
			</div>
			<div className={styles.actions}>
				<Button size="lg" iconLeft={PlayIcon} onClick={() => start(workout.id)}>{t("fit.today.start")}</Button>
				<Button size="lg" variant="secondary" onDark onClick={() => router.push(`/training/session/${workout.id}`)}>{t("fit.today.preview")}</Button>
			</div>
		</Card>
	);
}
