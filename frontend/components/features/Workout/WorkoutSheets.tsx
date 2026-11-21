"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Checkbox, EmptyState, Sheet } from "@/components/ui";
import { applyAdapt } from "@/lib/fit/adapt";
import { SAFETY_TEXT } from "@/lib/fit/coach";
import { alternativesFor, getExercise } from "@/lib/fit/exercises";
import { describeBlock } from "@/lib/fit/format";
import { useFit } from "@/lib/fit/store/FitProvider";
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

	const ACTIONS: { key: string; op?: AdaptOp; onClick?: () => void }[] = [
		{ key: "too-hard", op: { kind: "too-hard" } },
		{ key: "easier", op: { kind: "easier" } },
		{ key: "more-rest", op: { kind: "more-rest" } },
		{ key: "replace", onClick: () => setSheet("replace") },
		{ key: "min20", op: { kind: "shorten", minutes: 20 } },
		{ key: "tired", op: { kind: "tired" } },
		{
			key: "skip",
			onClick: () => {
				if (block) dispatch({ type: "skip-exercise", blockId: block.id });
				toastShow(t("fit.workout.skippedToast"), "info");
				setSheet(null);
			},
		},
		{
			key: "pause",
			onClick: () => {
				dispatch({ type: "pause" });
				setSheet(null);
			},
		},
		{ key: "end", onClick: () => setSheet("end") },
	];

	const alternatives = block ? alternativesFor(block.exerciseId, profile, a.exercises.map((b) => b.exerciseId)) : [];

	return (
		<>
			<Sheet open={sheet === "adjust"} onClose={() => setSheet(null)} title={t("fit.workout.adjustTitle")} closeLabel={t("common.close")}>
				<p className={styles.sheetLead}>{t("fit.workout.adjustLead")}</p>
				<ul className={styles.choices}>
					{ACTIONS.map((item) => (
						<li key={item.key}>
							<button type="button" className={styles.choice} onClick={() => (item.op ? run(item.op) : item.onClick?.())}>
								<strong>{t(`fit.workout.actions.${item.key}.label`)}</strong>
								<span>{t(`fit.workout.actions.${item.key}.hint`)}</span>
							</button>
						</li>
					))}
					<li>
						<button type="button" className={styles.choiceDanger} onClick={() => setSheet("safety")}>
							<strong>{t("fit.workout.unwell")}</strong>
							<span>{t("fit.workout.unwellHint")}</span>
						</button>
					</li>
				</ul>
			</Sheet>

			<Sheet open={sheet === "replace"} onClose={() => setSheet(null)} title={t("fit.workout.replaceTitle")} closeLabel={t("common.close")}>
				{block && <p className={styles.sheetLead}>{t("fit.workout.replaceLead", { name: getExercise(block.exerciseId).name })}</p>}
				{alternatives.length === 0 ? (
					<EmptyState title={t("fit.session.noAlternatives")} description={t("fit.session.noAlternativesBody")} />
				) : (
					<ul className={styles.choices}>
						{alternatives.map((o) => (
							<li key={o.id}>
								<button
									type="button"
									className={styles.choice}
									onClick={() => {
										if (block) dispatch({ type: "replace-exercise", blockId: block.id, exerciseId: o.id, today });
										toastShow(t("fit.session.replaced", { name: o.name }), "success");
										setSheet(null);
									}}
								>
									<strong>{o.name}</strong>
									<span>{t(`fit.level.${o.level}`)}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</Sheet>

			<Sheet open={sheet === "overview"} onClose={() => setSheet(null)} title={t("fit.workout.overviewTitle")} closeLabel={t("common.close")}>
				<ol className={styles.choices}>
					{a.exercises.map((b, i) => {
						const done = b.sets.filter((s) => s.done).length;
						return (
							<li key={b.id}>
								<button
									type="button"
									className={styles.choice}
									aria-current={i === a.index ? "step" : undefined}
									onClick={() => {
										dispatch({ type: "go-to", index: i });
										setSheet(null);
									}}
								>
									<strong>
										{i + 1}. {getExercise(b.exerciseId).name}
									</strong>
									<span>
										{b.skipped ? t("fit.workout.skippedLabel") : `${describeBlock(b)} · ${t("fit.workout.setsDone", { done, total: b.sets.length })}`}
									</span>
								</button>
							</li>
						);
					})}
				</ol>
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
