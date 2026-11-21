"use client";

import { Alert02Icon, ArrowLeft02Icon, ArrowRight02Icon, FavouriteIcon, PauseIcon, PlayIcon, SlidersHorizontalIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { useState, type ReactNode } from "react";
import { ExerciseGuide } from "@/components/features/ExerciseGuide/ExerciseGuide";
import { ExerciseVideo } from "@/components/features/ExerciseVideo/ExerciseVideo";
import { Button, Icon, IconButton, Stepper } from "@/components/ui";
import { formatClock } from "@/lib/fit/dates";
import { getExercise } from "@/lib/fit/exercises";
import type { HealthSample } from "@/lib/fit/health";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useUnits } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Workout.module.scss";

export function WorkoutStage({ onAdjust, onUnwell, sample }: { onAdjust: () => void; onUnwell: () => void; sample: HealthSample | null }) {
	const t = useT();
	const { state, dispatch } = useFit();
	const u = useUnits();
	const a = state.active;
	const block = a?.exercises[a.index];
	const setIndex = block ? block.sets.findIndex((s) => !s.done) : -1;
	const set = block && setIndex >= 0 ? block.sets[setIndex] : undefined;
	const exercise = block ? getExercise(block.exerciseId) : undefined;
	if (!a || !block || !exercise) return null;
	const timed = !!exercise.timed;
	const loaded = block.sets.some((s) => s.targetWeight !== undefined);
	const blockDone = setIndex < 0;
	const timerRunning = a.workLeft !== null;
	const logReps = !block.skipped && !blockDone && !timed;
	const previous = <IconButton icon={ArrowLeft02Icon} label={t("fit.workout.prev")} variant="secondary" disabled={a.index === 0} onClick={() => dispatch({ type: "go-to", index: a.index - 1 })} />;
	const next = <IconButton icon={ArrowRight02Icon} label={t("fit.workout.nextEx")} variant="secondary" disabled={a.index >= a.exercises.length - 1} onClick={() => dispatch({ type: "go-to", index: a.index + 1 })} />;

	return (
		<div className={styles.stage}>
			<div className={styles.stepBlock}>
				<ol className={styles.steps} aria-label={t("fit.workout.progress", { done: a.exercises.filter((b) => !b.skipped && b.sets.every((x) => x.done)).length, total: a.exercises.length })}>
					{a.exercises.map((b, i) => {
						const finished = !b.skipped && b.sets.every((x) => x.done);
						const state = i === a.index ? "current" : b.skipped ? "skipped" : finished || i < a.index ? "done" : "todo";
						return <li key={b.id} className={styles.step} data-state={state} />;
					})}
				</ol>
				<p className={styles.counter}>{t("fit.workout.exerciseOf", { n: a.index + 1, total: a.exercises.length })}</p>
			</div>

			<ExerciseVideo
				exercise={exercise}
				className={styles.video}
				fullWidth
				autoPlay
				hold={a.phase !== "work" || a.paused}
				header={
					<div className={styles.heroInfo}>
						<div className={styles.heroText}>
							<h1 className={styles.exName}>{exercise.name}</h1>
							<div className={styles.heroMeta}>
								<p className={styles.target}>
									{t("fit.workout.target", { sets: block.sets.length, reps: block.sets[0]?.target ?? 0 })}
									{timed ? " s" : ""}
									{loaded && block.sets[0]?.targetWeight ? ` · ${u.fmtLoad(block.sets[0].targetWeight)}` : ""}
								</p>
								<span className={styles.pulse} aria-label={t("fit.health.title")}>
									<Icon icon={FavouriteIcon} size={14} />
									{sample?.hr ?? "--"} <small>{t("fit.health.bpm")}</small>
								</span>
							</div>
						</div>
						<ExerciseGuide exercise={exercise} variant="sheet" />
					</div>
				}
			/>

			<ol className={styles.sets} aria-label={t("fit.workout.sets")}>
				{block.sets.map((s, i) => (
					<li key={i} className={clsx(styles.setRow, s.done && styles.setDone, i === setIndex && styles.setCurrent)}>
						<span className={styles.setNum}>{s.done ? <Icon icon={Tick02Icon} size={16} strokeWidth={3} /> : i + 1}</span>
						<span className={styles.setText}>
							{s.done ? `${s.reps}${timed ? " s" : ` ${t("fit.common.reps")}`}${s.weight ? ` · ${u.fmtLoad(s.weight)}` : ""}` : `${s.target}${timed ? " s" : ` ${t("fit.common.reps")}`}${s.targetWeight ? ` · ${u.fmtLoad(s.targetWeight)}` : ""}`}
						</span>
						<span className={styles.setState}>{s.done ? t("fit.workout.logged") : i === setIndex ? t("fit.workout.current") : ""}</span>
					</li>
				))}
			</ol>

			{block.skipped ? (
				<p className={styles.skipped}>{t("fit.workout.skippedNote")}</p>
			) : blockDone ? (
				<p className={styles.skipped}>{t("fit.workout.blockDone")}</p>
			) : logReps ? (
				<SetLogger key={`${block.id}-${setIndex}-${set?.target}-${set?.targetWeight}`} target={set?.target ?? 10} weight={set?.targetWeight} loaded={loaded} previous={previous} next={next} />
			) : null}

			{!logReps && (
				<div className={styles.controls}>
					{previous}
					{timed && !blockDone && !block.skipped && (
						<div className={styles.timerBox}>
							<span className={styles.clock} aria-live="off">{formatClock(timerRunning ? (a.workLeft ?? 0) : (set?.target ?? 0))}</span>
							<button
								type="button"
								className={styles.playBtn}
								aria-label={timerRunning ? t("fit.workout.pause") : t("fit.workout.startTimer", { s: set?.target ?? 0 })}
								onClick={() => (timerRunning ? dispatch({ type: "pause" }) : dispatch({ type: "start-timed" }))}
							>
								<Icon icon={timerRunning ? PauseIcon : PlayIcon} size={24} />
							</button>
						</div>
					)}
					{next}
				</div>
			)}
			{timed && timerRunning && !blockDone && (
				<Button size="lg" iconLeft={Tick02Icon} onClick={() => dispatch({ type: "log-set", reps: Math.max(1, (set?.target ?? 0) - (a.workLeft ?? 0)) })}>{t("fit.workout.finishSet")}</Button>
			)}
			<Button variant="secondary" iconLeft={SlidersHorizontalIcon} onClick={onAdjust}>{t("fit.workout.adjust")}</Button>
			<Button variant="ghost" iconLeft={Alert02Icon} onClick={onUnwell} className={styles.unwell}>{t("fit.workout.unwell")}</Button>
		</div>
	);
}

// Remounted per set (via key), so its inputs start from the set's targets without any effect-driven resets.
function SetLogger({ target, weight: targetWeight, loaded, previous, next }: { target: number; weight: number | undefined; loaded: boolean; previous: ReactNode; next: ReactNode }) {
	const t = useT();
	const { dispatch } = useFit();
	const u = useUnits();
	const [reps, setReps] = useState(target);
	const [weight, setWeight] = useState(targetWeight === undefined ? 0 : u.load(targetWeight));
	return (
		<div className={styles.logger}>
			<div className={styles.loggerFields} data-loaded={loaded || undefined}>
				<Stepper compact={loaded} label={t("fit.workout.repsLabel")} value={reps} onChange={setReps} min={1} max={100} unit={t("fit.common.reps")} decreaseLabel={t("fit.workout.decrease")} increaseLabel={t("fit.workout.increase")} />
				{loaded && <Stepper compact label={t("fit.workout.weightLabel")} value={weight} onChange={setWeight} min={0} max={u.units === "metric" ? 500 : 1100} step={u.step} unit={u.unit} decreaseLabel={t("fit.workout.decrease")} increaseLabel={t("fit.workout.increase")} />}
			</div>
			<div className={styles.controls}>
				{previous}
				<Button size="lg" iconLeft={Tick02Icon} onClick={() => dispatch({ type: "log-set", reps, weight: loaded ? u.toKg(weight) : undefined })} className={styles.complete}>
					{t("fit.workout.completeSet")}
				</Button>
				{next}
			</div>
		</div>
	);
}
