"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, EmptyState, Sheet } from "@/components/ui";
import { OptionCard } from "@/components/features/OptionCard/OptionCard";
import { getExercise } from "@/lib/fit/exercises";
import { useFit } from "@/lib/fit/store/FitProvider";
import { previewLog } from "@/lib/fit/store/reducer";
import type { Perceived } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Workout.module.scss";

export function WorkoutSummary() {
	const t = useT();
	const router = useRouter();
	const { state, dispatch, today } = useFit();
	const [confirmDiscard, setConfirmDiscard] = useState(false);
	const a = state.active;
	if (!a) return null;

	if (a.outcome === "empty") {
		return (
			<div className={styles.empty}>
				<EmptyState
					title={t("fit.summary.emptyTitle")}
					description={t("fit.summary.emptyBody")}
					action={
						<Button
							onClick={() => {
								dispatch({ type: "finish", today, now: new Date().toISOString() });
								router.replace("/training");
							}}
						>
							{t("fit.workout.toTraining")}
						</Button>
					}
				/>
			</div>
		);
	}

	const log = previewLog(state, a, today);
	const partial = log.status === "partial";
	const sets = log.exercises.reduce((n, e) => n + e.sets.length, 0);
	const perceived = a.perceived ?? "right";

	const save = (dest: string) => {
		dispatch({ type: "finish", today, now: new Date().toISOString() });
		router.replace(dest);
	};

	return (
		<div className={styles.summary}>
			<div className={styles.summaryHead}>
				<Badge tone={partial ? "warning" : "success"}>{partial ? t("fit.summary.partial") : t("fit.summary.complete")}</Badge>
				<h1 className={styles.sumTitle}>{partial ? t("fit.summary.partialTitle") : t("fit.summary.title")}</h1>
				<p className={styles.sumLead}>{partial ? t("fit.summary.partialLead") : t("fit.summary.lead", { title: a.title })}</p>
			</div>

			<div className={styles.sumGrid}>
				<Card className={styles.sumStat}><strong>{Math.max(1, Math.round(log.durationSec / 60))}</strong><span>{t("fit.common.minShort")}</span></Card>
				<Card className={styles.sumStat}><strong>{sets}</strong><span>{t("fit.common.sets")}</span></Card>
				<Card className={styles.sumStat}><strong>{log.volumeKg.toLocaleString("en-US")}</strong><span>kg</span></Card>
				<Card className={styles.sumStat}><strong>+{log.xp}</strong><span>XP</span></Card>
			</div>
			{log.avgHr && <p className={styles.note}>{t("fit.summary.avgHr", { n: log.avgHr })}</p>}

			{log.prs.length > 0 && (
				<Card className={styles.prCard}>
					<h2>{t("fit.summary.prs")}</h2>
					<ul>{log.prs.map((p) => <li key={p}>{p}</li>)}</ul>
				</Card>
			)}

			{a.adaptations.length > 0 && (
				<Card>
					<h2 className={styles.h2}>{t("fit.summary.adapted")}</h2>
					<ul className={styles.adaptList}>{a.adaptations.map((m, i) => <li key={i}>{m}</li>)}</ul>
					<p className={styles.note}>{t("fit.summary.adaptNote")}</p>
				</Card>
			)}

			<Card>
				<h2 className={styles.h2}>{t("fit.summary.exercises")}</h2>
				<ul className={styles.adaptList}>
					{log.exercises.map((e) => (
						<li key={e.exerciseId}>
							{getExercise(e.exerciseId).name}: {e.skipped ? t("fit.workout.skippedLabel") : `${e.sets.length} ${t("fit.common.sets")}`}
						</li>
					))}
				</ul>
			</Card>

			<fieldset className={styles.feel}>
				<legend className={styles.h2}>{t("fit.summary.feelTitle")}</legend>
				<p className={styles.note}>{t("fit.summary.feelNote")}</p>
				{(["easy", "right", "hard"] as Perceived[]).map((p) => (
					<OptionCard key={p} compact type="radio" name="perceived" label={t(`fit.summary.feel.${p}`)} checked={perceived === p} onChange={() => dispatch({ type: "set-perceived", value: p })} />
				))}
			</fieldset>

			<div className={styles.sumActions}>
				<Button size="lg" onClick={() => save("/progress")}>{t("fit.summary.save")}</Button>
				<Button variant="secondary" onClick={() => save("/today")}>{t("fit.summary.saveHome")}</Button>
				<Button variant="ghost" onClick={() => setConfirmDiscard(true)}>{t("fit.summary.discard")}</Button>
			</div>

			<Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title={t("fit.summary.discardTitle")} closeLabel={t("common.close")} variant="center" footer={
				<>
					<Button variant="secondary" onClick={() => setConfirmDiscard(false)}>{t("fit.common.cancel")}</Button>
					<Button variant="danger" onClick={() => { dispatch({ type: "discard-active" }); router.replace("/training"); }}>{t("fit.summary.discardConfirm")}</Button>
				</>
			}>
				<p>{t("fit.summary.discardBody")}</p>
			</Sheet>
		</div>
	);
}
