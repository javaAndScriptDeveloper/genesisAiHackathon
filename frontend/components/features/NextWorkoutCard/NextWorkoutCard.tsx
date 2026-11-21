"use client";

import { Clock01Icon, PlayIcon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { Button, Card, Icon, Picture, SportIcon } from "@/components/ui";
import { formatDay } from "@/lib/fit/dates";
import { kcalFor } from "@/lib/fit/calories";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useStartWorkout } from "@/lib/fit/store/hooks";
import type { PlannedWorkout } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./NextWorkoutCard.module.scss";

export function NextWorkoutCard({ workout }: { workout: PlannedWorkout }) {
	const t = useT();
	const router = useRouter();
	const { state, today } = useFit();
	const start = useStartWorkout();
	const kcal = kcalFor(workout.exercises.map((b) => b.exerciseId), state.profile?.weightKg ?? 70, workout.durationMin);
	return (
		<Card className={styles.card}>
			<Picture name="training-next-workout" alt="" width={900} height={600} sizes="(max-width: 576px) 100vw, 420px" className={styles.cover} />
			<span className={styles.level}>{t("fit.session.level", { n: workout.difficulty })}</span>
			<div className={styles.text}>
				<p className={styles.eyebrow}>{workout.date === today ? t("fit.training.today") : t("fit.training.upNext", { day: formatDay(workout.date) })}</p>
				<h2 className={styles.title}>{workout.title}</h2>
				<div className={styles.meta}>
					<span>
						<Icon icon={Clock01Icon} size={14} />
						{workout.durationMin} {t("fit.common.minShort")}
					</span>
					<span>
						<SportIcon name="flame" size={14} />
						{kcal} kcal
					</span>
				</div>
			</div>
			<div className={styles.actions}>
				<Button iconLeft={PlayIcon} onClick={() => start(workout.id)}>{t("fit.today.start")}</Button>
				<Button variant="secondary" onDark onClick={() => router.push(`/training/session/${workout.id}`)}>{t("fit.today.preview")}</Button>
			</div>
		</Card>
	);
}
