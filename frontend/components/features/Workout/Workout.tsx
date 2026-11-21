"use client";

import { Alert02Icon, ArrowDown01Icon, Cancel01Icon, PauseIcon, PlayIcon, Timer02Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, IconButton, Icon, useToast } from "@/components/ui";
import { WorkoutHealthPanel } from "@/components/features/WorkoutHealthPanel/WorkoutHealthPanel";
import { useWorkoutHealth } from "@/components/features/WorkoutHealthPanel/useWorkoutHealth";
import { applyAdapt } from "@/lib/fit/adapt";
import { formatClock } from "@/lib/fit/dates";
import type { AdaptOp } from "@/lib/fit/types";
import { getExercise } from "@/lib/fit/exercises";
import { estimateMinutes } from "@/lib/fit/plan";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import { RestView } from "./RestView";
import { WorkoutSheets, type SheetName } from "./WorkoutSheets";
import { WorkoutStage } from "./WorkoutStage";
import { WorkoutSummary } from "./WorkoutSummary";
import styles from "./Workout.module.scss";

export function Workout() {
	const t = useT();
	const router = useRouter();
	const toast = useToast();
	const { state, dispatch, today } = useFit();
	const [sheet, setSheet] = useState<SheetName>(null);
	const a = state.active;
	const profile = state.profile;
	const live = !!a && a.phase !== "summary";
	const running = live && !a.paused;

	useEffect(() => {
		if (!running) return;
		const id = window.setInterval(() => dispatch({ type: "tick" }), 1000);
		return () => window.clearInterval(id);
	}, [running, dispatch]);

	const block = a?.exercises[a.index];
	const intensity = !a || a.paused ? 0.05 : a.phase === "rest" ? 0.15 : block && getExercise(block.exerciseId).kind === "cardio" ? 0.85 : 0.6;
	const health = useWorkoutHealth({ enabled: live, intensity, age: profile?.age ?? 30, onSample: (bpm) => dispatch({ type: "hr", bpm }) });
	const minutesLeft = useMemo(() => (a ? estimateMinutes(a.exercises, 0) : 0), [a]);

	if (!a || !profile) {
		return (
			<div className={styles.empty}>
				<EmptyState title={t("fit.workout.noneTitle")} description={t("fit.workout.noneBody")} action={<Button onClick={() => router.replace("/training")}>{t("fit.workout.toTraining")}</Button>} />
			</div>
		);
	}

	if (a.phase === "summary") return <WorkoutSummary />;

	// On pause the most likely reason to stop is that it feels too hard: offer to regenerate the rest right here.
	const regenerate = (op: AdaptOp) => {
		const res = applyAdapt(a.exercises, op, { profile, startIndex: a.index });
		dispatch({ type: "adapt", op, today });
		dispatch({ type: "resume" });
		toast.show(res.message, res.changed ? "success" : "info");
	};

	const linked = state.devices.apple ? "Apple Health" : state.devices.garmin ? "Garmin" : undefined;
	const doneBlocks = a.exercises.filter((b) => !b.skipped && b.sets.every((s) => s.done)).length;

	return (
		<div className={styles.root}>
			<header className={styles.top}>
				<IconButton icon={Cancel01Icon} label={t("fit.workout.end")} onClick={() => setSheet("end")} />
				<div className={styles.topTitle}>
					<strong>{a.title}</strong>
					<span>
						{formatClock(a.elapsedSec)} · {t("fit.workout.left", { n: minutesLeft })}
					</span>
				</div>
				<IconButton icon={PauseIcon} label={t("fit.workout.pause")} onClick={() => dispatch({ type: "pause" })} />
			</header>
			<ol className={styles.segments} aria-label={t("fit.workout.progress", { done: doneBlocks, total: a.exercises.length })}>
				{a.exercises.map((b, i) => {
					const finished = !b.skipped && b.sets.every((s) => s.done);
					return <li key={b.id} className={styles.segment} data-state={b.skipped ? "skipped" : finished ? "done" : i === a.index ? "current" : "todo"} />;
				})}
			</ol>

			<div className={styles.scroll}>
				<WorkoutStage onAdjust={() => setSheet("adjust")} onOverview={() => setSheet("overview")} />
				<WorkoutHealthPanel sample={health.sample} zone={health.zone} alert={health.alert} elapsedSec={a.elapsedSec} resting={a.phase === "rest"} recoveryDrop={health.recoveryDrop} linkedTo={linked} />
				<Button variant="ghost" onClick={() => setSheet("safety")} className={styles.unwell}>
					{t("fit.workout.unwell")}
				</Button>
			</div>

			{a.phase === "rest" && !a.paused && <RestView onAdjust={() => setSheet("adjust")} />}

			{a.paused && !a.safetyStop && (
				<div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t("fit.workout.paused")}>
					<Icon icon={PauseIcon} size={40} />
					<h2>{t("fit.workout.paused")}</h2>
					<p>{t("fit.workout.pausedBody")}</p>
					<div className={styles.pausePrompt}>
						<p className={styles.pausePromptTitle}>
							<Icon icon={Alert02Icon} size={16} />
							{t("fit.workout.tooHardPrompt")}
						</p>
						<Button variant="secondary" className={styles.onDark} iconLeft={ArrowDown01Icon} onClick={() => regenerate({ kind: "too-hard" })}>{t("fit.workout.regenEasier")}</Button>
						<Button variant="secondary" className={styles.onDark} iconLeft={Timer02Icon} onClick={() => regenerate({ kind: "shorten", minutes: 15 })}>{t("fit.workout.regenShort")}</Button>
					</div>
					<Button size="lg" iconLeft={PlayIcon} onClick={() => dispatch({ type: "resume" })}>{t("fit.workout.resume")}</Button>
					<Button variant="secondary" className={styles.onDark} onClick={() => setSheet("end")}>{t("fit.workout.end")}</Button>
				</div>
			)}

			<WorkoutSheets sheet={sheet} setSheet={setSheet} toastShow={toast.show} />
		</div>
	);
}
