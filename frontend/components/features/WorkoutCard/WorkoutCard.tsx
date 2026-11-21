"use client";

import Link from "next/link";
import { Dumbbell03Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { Badge, Icon } from "@/components/ui";
import { formatDay } from "@/lib/fit/dates";
import { getExercise } from "@/lib/fit/exercises";
import type { PlannedWorkout } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./WorkoutCard.module.scss";

const TONE = { planned: "accent", completed: "success", partial: "warning", skipped: "neutral" } as const;

export function WorkoutCard({ workout, showDate = true }: { workout: PlannedWorkout; showDate?: boolean }) {
	const t = useT();
	const names = workout.exercises.slice(0, 3).map((b) => getExercise(b.exerciseId).name);
	return (
		<Link href={`/training/session/${workout.id}`} transitionTypes={["nav-forward"]} className={styles.card}>
			<span className={styles.icon}>
				<Icon icon={Dumbbell03Icon} size={22} />
			</span>
			<span className={styles.body}>
				<span className={styles.row}>
					<strong className={styles.title}>{workout.title}</strong>
					<Badge tone={TONE[workout.status]}>{t(`fit.status.${workout.status}`)}</Badge>
				</span>
				<span className={styles.meta}>
					{showDate && <span>{formatDay(workout.date)}</span>}
					<span className={styles.metaItem}>
						<Icon icon={Clock01Icon} size={14} />
						{workout.durationMin} {t("fit.common.minShort")}
					</span>
					<span>{t("fit.session.level", { n: workout.difficulty })}</span>
				</span>
				<span className={styles.names}>{names.join(", ")}{workout.exercises.length > 3 ? ` +${workout.exercises.length - 3}` : ""}</span>
			</span>
		</Link>
	);
}
