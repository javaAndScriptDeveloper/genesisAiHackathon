"use client";

import { ArrowLeft02Icon, ArrowRight02Icon, Mic02Icon, MicOff01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { ExerciseGuide } from "@/components/features/ExerciseGuide/ExerciseGuide";
import { ExerciseVideo } from "@/components/features/ExerciseVideo/ExerciseVideo";
import { Button, Icon, IconButton, Stepper, useToast } from "@/components/ui";
import { formatClock } from "@/lib/fit/dates";
import { getExercise } from "@/lib/fit/exercises";
import { listenOnce, parseSetPhrase, speechSupported } from "@/lib/fit/speech";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Workout.module.scss";

export function WorkoutStage({ onAdjust, onOverview }: { onAdjust: () => void; onOverview: () => void }) {
	const t = useT();
	const { state, dispatch } = useFit();
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

	return (
		<div className={styles.stage}>
			<div className={styles.exHead}>
				<p className={styles.counter}>{t("fit.workout.exerciseOf", { n: a.index + 1, total: a.exercises.length })}</p>
				<h1 className={styles.exName}>{exercise.name}</h1>
				<p className={styles.target}>
					{t("fit.workout.target", { sets: block.sets.length, reps: block.sets[0]?.target ?? 0 })}
					{timed ? " s" : ""}
					{loaded && block.sets[0]?.targetWeight ? ` · ${block.sets[0].targetWeight} kg` : ""}
				</p>
			</div>

			<ExerciseVideo exercise={exercise} compact />
			<ExerciseGuide exercise={exercise} defaultOpen={null} />

			<ol className={styles.sets} aria-label={t("fit.workout.sets")}>
				{block.sets.map((s, i) => (
					<li key={i} className={clsx(styles.setRow, s.done && styles.setDone, i === setIndex && styles.setCurrent)}>
						<span className={styles.setNum}>{s.done ? <Icon icon={Tick02Icon} size={16} strokeWidth={3} /> : i + 1}</span>
						<span className={styles.setText}>
							{s.done ? `${s.reps}${timed ? " s" : ` ${t("fit.common.reps")}`}${s.weight ? ` · ${s.weight} kg` : ""}` : `${s.target}${timed ? " s" : ` ${t("fit.common.reps")}`}${s.targetWeight ? ` · ${s.targetWeight} kg` : ""}`}
						</span>
						<span className={styles.setState}>{s.done ? t("fit.workout.logged") : i === setIndex ? t("fit.workout.current") : ""}</span>
					</li>
				))}
			</ol>

			{block.skipped ? (
				<p className={styles.skipped}>{t("fit.workout.skippedNote")}</p>
			) : blockDone ? (
				<p className={styles.skipped}>{t("fit.workout.blockDone")}</p>
			) : timed ? (
				<div className={styles.logger}>
					{timerRunning ? (
						<>
							<p className={styles.big} aria-live="off">{formatClock(a.workLeft ?? 0)}</p>
							<Button size="lg" onClick={() => dispatch({ type: "log-set", reps: Math.max(1, (set?.target ?? 0) - (a.workLeft ?? 0)) })}>{t("fit.workout.finishSet")}</Button>
						</>
					) : (
						<Button size="lg" onClick={() => dispatch({ type: "start-timed" })}>{t("fit.workout.startTimer", { s: set?.target ?? 0 })}</Button>
					)}
				</div>
			) : (
				<SetLogger key={`${block.id}-${setIndex}-${set?.target}-${set?.targetWeight}`} target={set?.target ?? 10} weight={set?.targetWeight} loaded={loaded} />
			)}

			<div className={styles.navRow}>
				<Button variant="secondary" iconLeft={ArrowLeft02Icon} disabled={a.index === 0} onClick={() => dispatch({ type: "go-to", index: a.index - 1 })}>{t("fit.workout.prev")}</Button>
				<Button variant="secondary" onClick={onOverview}>{t("fit.workout.all")}</Button>
				<Button variant="secondary" iconRight={ArrowRight02Icon} disabled={a.index >= a.exercises.length - 1} onClick={() => dispatch({ type: "go-to", index: a.index + 1 })}>{t("fit.workout.nextEx")}</Button>
			</div>
			<Button variant="ghost" onClick={onAdjust}>{t("fit.workout.adjust")}</Button>
		</div>
	);
}

// Remounted per set (via key), so its inputs start from the set's targets without any effect-driven resets.
function SetLogger({ target, weight: targetWeight, loaded }: { target: number; weight: number | undefined; loaded: boolean }) {
	const t = useT();
	const toast = useToast();
	const { dispatch } = useFit();
	const [reps, setReps] = useState(target);
	const [weight, setWeight] = useState(targetWeight ?? 0);
	const [listening, setListening] = useState(false);
	const stop = useRef<(() => void) | null>(null);
	useEffect(() => () => stop.current?.(), []);

	const voice = () => {
		if (listening) {
			stop.current?.();
			return;
		}
		const stopFn = listenOnce({
			onText: (text) => {
				const parsed = parseSetPhrase(text);
				if (parsed.reps === undefined && parsed.weight === undefined) {
					toast.show(t("fit.workout.voiceUnclear", { text }), "danger");
					return;
				}
				if (parsed.reps !== undefined) setReps(parsed.reps);
				if (parsed.weight !== undefined) setWeight(parsed.weight);
				toast.show(t("fit.workout.voiceHeard", { reps: parsed.reps ?? reps, weight: parsed.weight ?? weight }), "success");
			},
			onEnd: () => setListening(false),
			onError: () => {
				setListening(false);
				toast.show(t("fit.workout.voiceError"), "danger");
			},
		});
		if (!stopFn) return;
		stop.current = stopFn;
		setListening(true);
	};

	return (
		<div className={styles.logger}>
			<Stepper label={t("fit.workout.repsLabel")} value={reps} onChange={setReps} min={1} max={100} unit={t("fit.common.reps")} decreaseLabel={t("fit.workout.decrease")} increaseLabel={t("fit.workout.increase")} />
			{loaded && <Stepper label={t("fit.workout.weightLabel")} value={weight} onChange={setWeight} min={0} max={500} step={2.5} unit="kg" decreaseLabel={t("fit.workout.decrease")} increaseLabel={t("fit.workout.increase")} />}
			<div className={styles.loggerRow}>
				<Button size="lg" iconLeft={Tick02Icon} onClick={() => dispatch({ type: "log-set", reps, weight: loaded ? weight : undefined })} className={styles.complete}>
					{t("fit.workout.completeSet")}
				</Button>
				<IconButton icon={listening ? MicOff01Icon : Mic02Icon} label={speechSupported() ? (listening ? t("fit.workout.voiceStop") : t("fit.workout.voiceStart")) : t("fit.workout.voiceUnsupported")} variant="secondary" disabled={!speechSupported()} onClick={voice} />
			</div>
			<p className={styles.hint}>{speechSupported() ? t("fit.workout.voiceHint") : t("fit.workout.voiceUnsupported")}</p>
		</div>
	);
}
