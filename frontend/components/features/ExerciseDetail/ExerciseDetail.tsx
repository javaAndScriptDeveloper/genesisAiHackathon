"use client";

import { ExerciseGuide } from "@/components/features/ExerciseGuide/ExerciseGuide";
import { ExerciseVideo } from "@/components/features/ExerciseVideo/ExerciseVideo";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Badge, Button, EmptyState } from "@/components/ui";
import { findExercise } from "@/lib/fit/exercises";
import { useT } from "@/lib/i18n/I18nProvider";
import { useRouter } from "next/navigation";
import styles from "./ExerciseDetail.module.scss";

export function ExerciseDetail({ id }: { id: string }) {
	const t = useT();
	const router = useRouter();
	const exercise = findExercise(id);
	if (!exercise) return <><ScreenHeader title={t("fit.exercise.title")} back /><div className={styles.pad}><EmptyState title={t("fit.exercise.notFound")} action={<Button onClick={() => router.push("/training")}>{t("fit.exercise.backToLibrary")}</Button>} /></div></>;
	return (
		<div className={styles.root}>
			<ScreenHeader title={exercise.name} back />
			<div className={styles.content}>
				<ExerciseVideo exercise={exercise} />
				<div className={styles.badges}>
					<Badge tone="accent">{t(`fit.muscle.${exercise.muscle}`)}</Badge>
					<Badge>{t(`fit.level.${exercise.level}`)}</Badge>
					<Badge>{exercise.equipment.length ? exercise.equipment.map((e) => t(`fit.opt.equipment.${e}`)).join(" + ") : t("fit.exercise.noEquipment")}</Badge>
				</div>
				<p className={styles.summary}>{exercise.summary}</p>
				<ExerciseGuide exercise={exercise} />
			</div>
		</div>
	);
}
