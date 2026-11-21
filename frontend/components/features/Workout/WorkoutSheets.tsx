"use client";

import { Alert02Icon, ArrowDown01Icon, ArrowReloadHorizontalIcon, Clock01Icon, Dumbbell03Icon, Moon01Icon, PauseIcon, SkipForwardIcon, StopIcon, Timer02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChoiceList, type Choice } from "@/components/features/ChoiceList/ChoiceList";
import { Button, Checkbox, EmptyState, Sheet, type IconDefinition } from "@/components/ui";
import { applyAdapt } from "@/lib/fit/adapt";
import { SAFETY_TEXT } from "@/lib/fit/coach";
import { alternativesFor, getExercise } from "@/lib/fit/exercises";
import { describeBlock } from "@/lib/fit/format";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useUnits } from "@/lib/fit/store/hooks";
import type { AdaptOp } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Workout.module.scss";

export type SheetName = null | "adjust" | "replace" | "overview" | "end" | "safety";

interface Props {
	sheet: SheetName;
	setSheet: (s: SheetName) => void;
	toastShow: (message: string, tone?: "info" | "success" | "danger") => void;
}

export function WorkoutSheets({ sheet, setSheet, toastShow }: Props) {
	const t = useT();
	const router = useRouter();
	const { state, dispatch, today } = useFit();
	const u = useUnits();
	const a = state.active;
	const profile = state.profile;

	// Opening the safety flow immediately pauses the session and blocks any automatic intensity change.
	useEffect(() => {
		if (sheet === "safety") {
			dispatch({ type: "safety-stop" });
			setSheet(null);
		}
	}, [sheet, dispatch, setSheet]);

	if (!a || !profile) return null;
	const block = a.exercises[a.index];
	const setsDone = a.exercises.reduce((n, b) => n + b.sets.filter((s) => s.done).length, 0);

	const run = (op: AdaptOp) => {
		const res = applyAdapt(a.exercises, op, { profile, startIndex: a.index });
		dispatch({ type: "adapt", op, today });
		toastShow(res.message, res.changed ? "success" : "info");
		setSheet(null);
	};

	const ACTIONS: { key: string; icon: IconDefinition; op?: AdaptOp; onClick?: () => void }[] = [
		{ key: "too-hard", icon: Alert02Icon, op: { kind: "too-hard" } },
		{ key: "easier", icon: ArrowDown01Icon, op: { kind: "easier" } },
		{ key: "more-rest", icon: Clock01Icon, op: { kind: "more-rest" } },
		{ key: "replace", icon: ArrowReloadHorizontalIcon, onClick: () => setSheet("replace") },
		{ key: "min20", icon: Timer02Icon, op: { kind: "shorten", minutes: 20 } },
		{ key: "tired", icon: Moon01Icon, op: { kind: "tired" } },
		{
			key: "skip",
			icon: SkipForwardIcon,
			onClick: () => {
				if (block) dispatch({ type: "skip-exercise", blockId: block.id });
				toastShow(t("fit.workout.skippedToast"), "info");
				setSheet(null);
			},
		},
		{
			key: "pause",
			icon: PauseIcon,
			onClick: () => {
				dispatch({ type: "pause" });
				setSheet(null);
			},
		},
		{ key: "end", icon: StopIcon, onClick: () => setSheet("end") },
	];

	const alternatives = block ? alternativesFor(block.exerciseId, profile, a.exercises.map((b) => b.exerciseId)) : [];

	return (
		<>
			<Sheet open={sheet === "adjust"} onClose={() => setSheet(null)} title={t("fit.workout.adjustTitle")} closeLabel={t("common.close")}>
				<p className={styles.sheetLead}>{t("fit.workout.adjustLead")}</p>
				<ChoiceList
					items={[
						...ACTIONS.map((item): Choice => ({ key: item.key, icon: item.icon, title: t(`fit.workout.actions.${item.key}.label`), hint: t(`fit.workout.actions.${item.key}.hint`), onClick: () => (item.op ? run(item.op) : item.onClick?.()) })),
						{ key: "unwell", icon: Alert02Icon, tone: "danger", title: t("fit.workout.unwell"), hint: t("fit.workout.unwellHint"), onClick: () => setSheet("safety") },
					]}
				/>
			</Sheet>

			<Sheet open={sheet === "replace"} onClose={() => setSheet(null)} title={t("fit.workout.replaceTitle")} closeLabel={t("common.close")}>
				{block && <p className={styles.sheetLead}>{t("fit.workout.replaceLead", { name: getExercise(block.exerciseId).name })}</p>}
				{alternatives.length === 0 ? (
					<EmptyState title={t("fit.session.noAlternatives")} description={t("fit.session.noAlternativesBody")} />
				) : (
					<ChoiceList
						items={alternatives.map((o) => ({
							key: o.id,
							icon: Dumbbell03Icon,
							title: o.name,
							hint: t(`fit.level.${o.level}`),
							onClick: () => {
								if (block) dispatch({ type: "replace-exercise", blockId: block.id, exerciseId: o.id, today });
								toastShow(t("fit.session.replaced", { name: o.name }), "success");
								setSheet(null);
							},
						}))}
					/>
				)}
			</Sheet>

			<Sheet open={sheet === "overview"} onClose={() => setSheet(null)} title={t("fit.workout.overviewTitle")} closeLabel={t("common.close")}>
				<ChoiceList
					ordered
					items={a.exercises.map((b, i) => {
						const done = b.sets.filter((s) => s.done).length;
						const finished = !b.skipped && done === b.sets.length;
						return {
							key: b.id,
							icon: finished ? Tick02Icon : b.skipped ? SkipForwardIcon : Dumbbell03Icon,
							title: `${i + 1}. ${getExercise(b.exerciseId).name}`,
							hint: b.skipped ? t("fit.workout.skippedLabel") : `${describeBlock(b, u.units)} · ${t("fit.workout.setsDone", { done, total: b.sets.length })}`,
							current: i === a.index,
							onClick: () => {
								dispatch({ type: "go-to", index: i });
								setSheet(null);
							},
						};
					})}
				/>
			</Sheet>

			<Sheet open={sheet === "end"} onClose={() => setSheet(null)} title={t("fit.workout.endTitle")} closeLabel={t("common.close")} variant="center" footer={
				<>
					<Button variant="secondary" onClick={() => setSheet(null)}>{t("fit.workout.keepGoing")}</Button>
					<Button
						variant="danger"
						onClick={() => {
							setSheet(null);
							if (setsDone > 0) dispatch({ type: "end-early" });
							else {
								dispatch({ type: "discard-active" });
								router.replace("/training");
							}
						}}
					>
						{setsDone > 0 ? t("fit.workout.endSave") : t("fit.workout.endLeave")}
					</Button>
				</>
			}>
				<p>{setsDone > 0 ? t("fit.workout.endBody", { n: setsDone }) : t("fit.workout.endEmpty")}</p>
				<div className={styles.endPrompt}>
					<p>{t("fit.workout.tooHardPrompt")}</p>
					<Button variant="secondary" iconLeft={ArrowDown01Icon} onClick={() => run({ kind: "too-hard" })}>{t("fit.workout.regenEasier")}</Button>
				</div>
			</Sheet>

			<SafetySheet open={a.safetyStop} onEnd={() => dispatch({ type: "end-early" })} onResume={() => dispatch({ type: "resume" })} />
		</>
	);
}

function SafetySheet({ open, onEnd, onResume }: { open: boolean; onEnd: () => void; onResume: () => void }) {
	const t = useT();
	const [rested, setRested] = useState(false);
	// Sheet renders nothing while closed, but this component stays mounted; the checkbox must start unchecked every time.
	return (
		<Sheet
			open={open}
			onClose={() => undefined}
			title={t("fit.safety.title")}
			variant="center"
			modal
			footer={
				<>
					<Button variant="danger" onClick={onEnd}>{t("fit.workout.end")}</Button>
					<Button
						disabled={!rested}
						onClick={() => {
							setRested(false);
							onResume();
						}}
					>
						{t("fit.safety.resume")}
					</Button>
				</>
			}
		>
			<ul className={styles.safetyList}>
				{SAFETY_TEXT.map((line) => (
					<li key={line}>{line}</li>
				))}
			</ul>
			<Checkbox label={t("fit.safety.rested")} checked={rested} onChange={(e) => setRested(e.target.checked)} />
		</Sheet>
	);
}
