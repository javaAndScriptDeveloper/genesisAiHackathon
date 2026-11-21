"use client";

import type { Exercise } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ExerciseGuide.module.scss";

// Instructions, technique tips, breathing and common mistakes as native disclosure widgets: keyboard and screen-reader friendly.
export function ExerciseGuide({ exercise, defaultOpen = "steps" }: { exercise: Exercise; defaultOpen?: "steps" | "tips" | "breathing" | "mistakes" | null }) {
	const t = useT();
	const sections: { id: "steps" | "tips" | "breathing" | "mistakes"; body: string[] }[] = [
		{ id: "steps", body: exercise.steps },
		{ id: "tips", body: exercise.tips },
		{ id: "breathing", body: [exercise.breathing] },
		{ id: "mistakes", body: exercise.mistakes },
	];
	return (
		<div className={styles.root}>
			{sections.map((s) => (
				<details key={s.id} className={styles.item} open={defaultOpen === s.id}>
					<summary className={styles.summary}>{t(`fit.guide.${s.id}`)}</summary>
					{s.id === "steps" ? (
						<ol className={styles.list}>
							{s.body.map((line) => (
								<li key={line}>{line}</li>
							))}
						</ol>
					) : (
						<ul className={styles.list}>
							{s.body.map((line) => (
								<li key={line}>{line}</li>
							))}
						</ul>
					)}
				</details>
			))}
		</div>
	);
}
