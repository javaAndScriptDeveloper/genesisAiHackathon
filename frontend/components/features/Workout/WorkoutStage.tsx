"use client";

import { Alert02Icon, ArrowLeft02Icon, ArrowRight02Icon, FavouriteIcon, ListViewIcon, Mic02Icon, MicOff01Icon, PauseIcon, PlayIcon, SlidersHorizontalIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { ExerciseGuide } from "@/components/features/ExerciseGuide/ExerciseGuide";
import { ExerciseVideo } from "@/components/features/ExerciseVideo/ExerciseVideo";
import { Button, Icon, IconButton, Stepper, useToast } from "@/components/ui";
import { formatClock } from "@/lib/fit/dates";
import { getExercise } from "@/lib/fit/exercises";
import { listenOnce, parseSetPhrase, speechSupported } from "@/lib/fit/speech";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useUnits } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Workout.module.scss";

export function WorkoutStage({ onAdjust, onOverview, onUnwell, bpm }: { onAdjust: () => void; onOverview: () => void; onUnwell: () => void; bpm: number | null }) {
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
				autoPlay
				overlay={
					<div className={styles.heroInfo}>
						<div className={styles.heroText}>
							<h1 className={styles.exName}>{exercise.name}</h1>
							<p className={styles.target}>
								{t("fit.workout.target", { sets: block.sets.length, reps: block.sets[0]?.target ?? 0 })}
								{timed ? " s" : ""}
								{loaded && block.sets[0]?.targetWeight ? ` · ${u.fmtLoad(block.sets[0].targetWeight)}` : ""}
							</p>
						</div>
						<span className={styles.pulse} aria-label={t("fit.health.title")}>
							<Icon icon={FavouriteIcon} size={14} />
							{bpm ?? "--"} <small>{t("fit.health.bpm")}</small>
						</span>
					</div>
				}
			/>
			<ExerciseGuide exercise={exercise} variant="sheet" />

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
			) : timed ? null : (
				<SetLogger key={`${block.id}-${setIndex}-${set?.target}-${set?.targetWeight}`} target={set?.target ?? 10} weight={set?.targetWeight} loaded={loaded} />
			)}

			<div className={styles.controls}>
				<IconButton icon={ArrowLeft02Icon} label={t("fit.workout.prev")} variant="secondary" disabled={a.index === 0} onClick={() => dispatch({ type: "go-to", index: a.index - 1 })} />
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
				<IconButton icon={ArrowRight02Icon} label={t("fit.workout.nextEx")} variant="secondary" disabled={a.index >= a.exercises.length - 1} onClick={() => dispatch({ type: "go-to", index: a.index + 1 })} />
				<IconButton icon={ListViewIcon} label={t("fit.workout.all")} variant="secondary" onClick={onOverview} />
			</div>
			{timed && timerRunning && !blockDone && (
				<Button variant="ghost" iconLeft={Tick02Icon} onClick={() => dispatch({ type: "log-set", reps: Math.max(1, (set?.target ?? 0) - (a.workLeft ?? 0)) })}>{t("fit.workout.finishSet")}</Button>
			)}
			<Button variant="secondary" iconLeft={SlidersHorizontalIcon} onClick={onAdjust}>{t("fit.workout.adjust")}</Button>
			<Button variant="ghost" iconLeft={Alert02Icon} onClick={onUnwell} className={styles.unwell}>{t("fit.workout.unwell")}</Button>
		</div>
	);
}

// Remounted per set (via key), so its inputs start from the set's targets without any effect-driven resets.
function SetLogger({ target, weight: targetWeight, loaded }: { target: number; weight: number | undefined; loaded: boolean }) {
	const t = useT();
	const toast = useToast();
	const { dispatch } = useFit();
	const u = useUnits();
	const [reps, setReps] = useState(target);
	const [weight, setWeight] = useState(targetWeight === undefined ? 0 : u.load(targetWeight));
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
				if (parsed.weight !== undefined) setWeight(parsed.unit && parsed.unit !== u.unit ? (parsed.unit === "kg" ? u.load(parsed.weight) : u.load(parsed.weight * 0.45359237)) : parsed.weight);
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
			{loaded && <Stepper label={t("fit.workout.weightLabel")} value={weight} onChange={setWeight} min={0} max={u.units === "metric" ? 500 : 1100} step={u.step} unit={u.unit} decreaseLabel={t("fit.workout.decrease")} increaseLabel={t("fit.workout.increase")} />}
			<div className={styles.loggerRow}>
				<Button size="lg" iconLeft={Tick02Icon} onClick={() => dispatch({ type: "log-set", reps, weight: loaded ? u.toKg(weight) : undefined })} className={styles.complete}>
					{t("fit.workout.completeSet")}
				</Button>
				<IconButton icon={listening ? MicOff01Icon : Mic02Icon} label={speechSupported() ? (listening ? t("fit.workout.voiceStop") : t("fit.workout.voiceStart")) : t("fit.workout.voiceUnsupported")} variant="secondary" disabled={!speechSupported()} onClick={voice} />
			</div>
			<p className={styles.hint}>{speechSupported() ? t("fit.workout.voiceHint") : t("fit.workout.voiceUnsupported")}</p>
		</div>
	);
}
