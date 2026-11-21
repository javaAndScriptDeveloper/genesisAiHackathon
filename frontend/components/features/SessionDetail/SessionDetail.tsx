"use client";

import { ArrowDown01Icon, ArrowReloadHorizontalIcon, ArrowUp01Icon, Calendar03Icon, Clock01Icon, Dumbbell01Icon, Dumbbell03Icon, FireIcon, HeartCheckIcon, Moon01Icon, PlayIcon, SkipForwardIcon, SlidersHorizontalIcon, Tick02Icon, Timer02Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MuscleMap } from "@/components/features/MuscleMap/MuscleMap";
import { ChoiceList } from "@/components/features/ChoiceList/ChoiceList";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Badge, Button, Card, EmptyState, Icon, IconButton, KIND_ICON, Picture, Sheet, SportIcon, useToast, type IconDefinition } from "@/components/ui";
import { kcalFor } from "@/lib/fit/calories";
import { musclesOf } from "@/lib/fit/muscles";
import { addDays, formatDay, mondayOf, WEEKDAYS, weekdayIndex } from "@/lib/fit/dates";
import { alternativesFor, getExercise } from "@/lib/fit/exercises";
import { describeBlock } from "@/lib/fit/format";
import { applyAdapt } from "@/lib/fit/adapt";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useStartWorkout, useUnits } from "@/lib/fit/store/hooks";
import type { AdaptOp, SkipReason } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./SessionDetail.module.scss";

type Panel = null | "adjust" | "move" | "skip" | { replace: string };

export function SessionDetail({ id }: { id: string }) {
	const t = useT();
	const router = useRouter();
	const toast = useToast();
	const { state, dispatch, today } = useFit();
	const start = useStartWorkout();
	const u = useUnits();
	const [panel, setPanel] = useState<Panel>(null);
	const workout = state.planned.find((w) => w.id === id);
	const profile = state.profile;

	if (!workout || !profile) {
		return (
			<>
				<ScreenHeader title={t("fit.session.title")} back="/training" />
				<div className={styles.pad}>
					<EmptyState title={t("fit.session.notFound")} description={t("fit.session.notFoundBody")} action={<Button onClick={() => router.push("/training")}>{t("fit.session.toTraining")}</Button>} />
				</div>
			</>
		);
	}

	const editable = workout.status === "planned";
	const ids = workout.exercises.map((b) => b.exerciseId);
	const kcal = kcalFor(ids, profile.weightKg, workout.durationMin);
	const totalSets = workout.exercises.reduce((n, b) => n + b.sets.length, 0);
	const muscles = musclesOf(workout.exercises);
	const equipment = Array.from(new Set(ids.flatMap((id) => getExercise(id).equipment)));
	// "Knee-friendly" etc.: only for the limitations this user reported, and only when no exercise here loads that area.
	const friendly = profile.limitations.filter((l) => l !== "heart-bp" && !ids.some((id) => getExercise(id).stresses.includes(l)));
	const log = workout.logId ? state.history.find((l) => l.id === workout.logId) : undefined;
	const trainedToday = state.planned.some((w) => w.date === today && w.id !== workout.id && (w.status === "completed" || w.status === "partial"));
	const active = !!state.active && state.active.phase !== "summary";

	const adapt = (op: AdaptOp) => {
		const res = applyAdapt(workout.exercises, op, { profile, startIndex: 0 });
		if (!res.changed) toast.show(res.message, "info");
		else {
			dispatch({ type: "adapt-planned", id: workout.id, op, today });
			toast.show(res.message, "success");
		}
		setPanel(null);
	};

	const ADJUSTMENTS: { key: string; op: AdaptOp; icon: IconDefinition }[] = [
		{ key: "easier", op: { kind: "easier" }, icon: ArrowDown01Icon },
		{ key: "harder", op: { kind: "harder" }, icon: ArrowUp01Icon },
		{ key: "more-rest", op: { kind: "more-rest" }, icon: Clock01Icon },
		{ key: "min20", op: { kind: "shorten", minutes: 20 }, icon: Timer02Icon },
		{ key: "min30", op: { kind: "shorten", minutes: 30 }, icon: Timer02Icon },
		{ key: "tired", op: { kind: "tired" }, icon: Moon01Icon },
	];
	const REASON_ICONS: Record<SkipReason, IconDefinition> = { recovery: Moon01Icon, unwell: HeartCheckIcon, busy: Calendar03Icon };

	const monday = mondayOf(workout.date);
	const dayChoices = Array.from({ length: 14 }, (_, i) => addDays(monday, i)).filter((d) => d >= today);

	const replacing = typeof panel === "object" && panel !== null ? workout.exercises.find((b) => b.id === panel.replace) : undefined;

	return (
		<div className={styles.root}>
			<ScreenHeader title={workout.title} subtitle={formatDay(workout.date)} back="/training" />
			<div className={styles.content}>
				<div className={styles.hero}>
					<Picture name={`training-${muscles.length === 1 ? muscles[0] : "all"}`} alt="" width={384} height={384} sizes="(max-width: 576px) 100vw, 420px" className={styles.cover} />
					<div className={styles.heroBadges}>
						<Badge tone={workout.status === "planned" ? "accent" : workout.status === "completed" ? "success" : "neutral"}>{t(`fit.status.${workout.status}`)}</Badge>
						<Badge>{t("fit.session.level", { n: workout.difficulty })}</Badge>
						{workout.adHoc && <Badge tone="warning">{t("fit.session.extra")}</Badge>}
						{workout.movedFrom && <Badge>{t("fit.session.moved", { day: formatDay(workout.movedFrom) })}</Badge>}
					</div>
				</div>

				<ul className={styles.stats}>
					<li>
						<Icon icon={Clock01Icon} size={20} />
						<strong>{workout.durationMin}</strong>
						<span>{t("fit.common.minShort")}</span>
					</li>
					<li>
						<Icon icon={FireIcon} size={20} />
						<strong>{kcal}</strong>
						<span>kcal</span>
					</li>
					<li>
						<Icon icon={Dumbbell01Icon} size={20} />
						<strong>{totalSets}</strong>
						<span>{t("fit.common.sets")}</span>
					</li>
				</ul>

				<Card className={styles.targets}>
					{muscles.length > 0 && (
						<div className={styles.targetMap}>
							<MuscleMap muscles={muscles} variant="pair" label={t("fit.session.targets")} />
						</div>
					)}
					<div className={styles.targetInfo}>
						<p className={styles.eyebrow}>{t("fit.session.targets")}</p>
						<div className={styles.badges}>
							{(muscles.length ? muscles : (["mobility"] as const)).map((m) => <Badge key={m} tone="accent">{t(`fit.muscle.${m}`)}</Badge>)}
						</div>
						<p className={styles.eyebrow}>{t("fit.session.equipmentTitle")}</p>
						<div className={styles.badges}>
							{equipment.length === 0 ? <Badge>{t("fit.session.bodyweightOnly")}</Badge> : equipment.map((e) => <Badge key={e}><SportIcon name="dumbbell" size={12} />{t(`fit.opt.equipment.${e}`)}</Badge>)}
							{friendly.map((l) => <Badge key={l} tone="success"><Icon icon={Tick02Icon} size={12} strokeWidth={3} />{t("fit.session.friendly", { part: t(`fit.opt.limitation.${l}.label`) })}</Badge>)}
						</div>
					</div>
				</Card>

				{trainedToday && editable && <p className={styles.warn}>{t("fit.session.restWarning")}</p>}
				{workout.adHoc && <p className={styles.note}>{t("fit.session.extraNote")}</p>}
				{workout.status === "skipped" && <p className={styles.note}>{t(`fit.session.skipped.${workout.skipReason ?? "busy"}`)}</p>}

				{editable && (
					<div className={styles.actions}>
						<Button size="lg" iconLeft={PlayIcon} disabled={active} onClick={() => start(workout.id)}>{t("fit.session.start")}</Button>
						{active && <p className={styles.note}>{t("fit.session.alreadyActive")}</p>}
						<div className={styles.row}>
							<Button variant="secondary" size="sm" iconLeft={SlidersHorizontalIcon} onClick={() => setPanel("adjust")}>{t("fit.session.adjust")}</Button>
							<Button variant="secondary" size="sm" iconLeft={Calendar03Icon} onClick={() => setPanel("move")}>{t("fit.session.move")}</Button>
							<Button variant="secondary" size="sm" iconLeft={SkipForwardIcon} onClick={() => setPanel("skip")}>{t("fit.session.skip")}</Button>
						</div>
					</div>
				)}

				{log && (
					<Card className={styles.logCard}>
						<h2>{t("fit.session.result")}</h2>
						<p>
							{Math.round(log.durationSec / 60)} {t("fit.common.minShort")} · {u.fmtMass(log.volumeKg)} · +{log.xp} XP
						</p>
						{log.prs.length > 0 && <p className={styles.pr}>{t("fit.session.prs", { list: log.prs.join(", ") })}</p>}
					</Card>
				)}

				<h2 className={styles.h2}>
					{t("fit.session.exerciseList")}
					<span>{workout.exercises.length}</span>
				</h2>
				<ol className={styles.list}>
					{workout.exercises.map((b, i) => {
						const ex = getExercise(b.exerciseId);
						return (
							<li key={b.id} className={styles.item}>
								<span className={styles.exIcon}>
									<SportIcon name={KIND_ICON[ex.kind]} size={22} />
									<span className={styles.num}>{i + 1}</span>
								</span>
								<div className={styles.itemBody}>
									<Link href={`/training/exercise/${ex.id}`} className={styles.itemName}>{ex.name}</Link>
									<span className={styles.itemMeta}>
										<span className={styles.metaChip}>{describeBlock(b, u.units)}</span>
										<span className={styles.metaChip}><Icon icon={Timer02Icon} size={13} />{t("fit.session.rest", { s: b.restSec })}</span>
									</span>
								</div>
								<span className={styles.itemSide}>
									<Badge>{t(`fit.muscle.${ex.muscle}`)}</Badge>
									{editable && <IconButton icon={ArrowReloadHorizontalIcon} label={t("fit.session.replace")} onClick={() => setPanel({ replace: b.id })} />}
								</span>
							</li>
						);
					})}
				</ol>
			</div>

			<Sheet open={panel === "adjust"} onClose={() => setPanel(null)} title={t("fit.session.adjustTitle")} closeLabel={t("common.close")}>
				<p className={styles.sheetLead}>{t("fit.session.adjustLead")}</p>
				<ChoiceList items={ADJUSTMENTS.map((a) => ({ key: a.key, icon: a.icon, title: t(`fit.adapt.${a.key}.label`), hint: t(`fit.adapt.${a.key}.hint`), onClick: () => adapt(a.op) }))} />
			</Sheet>

			<Sheet open={panel === "move"} onClose={() => setPanel(null)} title={t("fit.session.moveTitle")} closeLabel={t("common.close")}>
				<p className={styles.sheetLead}>{t("fit.session.moveLead")}</p>
				<ChoiceList
					items={dayChoices.map((d) => {
						const clash = state.planned.find((w) => w.date === d && w.id !== workout.id && !w.adHoc);
						return {
							key: d,
							icon: Calendar03Icon,
							title: `${WEEKDAYS[weekdayIndex(d)]}, ${formatDay(d)}`,
							hint: d === workout.date ? t("fit.session.currentDay") : clash ? t("fit.session.dayTaken", { title: clash.title }) : t("fit.session.dayFree"),
							disabled: !!clash || d === workout.date,
							onClick: () => {
								dispatch({ type: "move-planned", id: workout.id, date: d });
								toast.show(t("fit.session.moved", { day: formatDay(d) }), "success");
								setPanel(null);
							},
						};
					})}
				/>
			</Sheet>

			<Sheet open={panel === "skip"} onClose={() => setPanel(null)} title={t("fit.session.skipTitle")} closeLabel={t("common.close")}>
				<p className={styles.sheetLead}>{t("fit.session.skipLead")}</p>
				<ChoiceList
					items={(["recovery", "unwell", "busy"] as SkipReason[]).map((reason) => ({
						key: reason,
						icon: REASON_ICONS[reason],
						title: t(`fit.session.reason.${reason}.label`),
						hint: t(`fit.session.reason.${reason}.hint`),
						onClick: () => {
							dispatch({ type: "skip-planned", id: workout.id, reason });
							toast.show(t(`fit.session.skipToast.${reason}`), "info");
							setPanel(null);
						},
					}))}
				/>
			</Sheet>

			<Sheet open={!!replacing} onClose={() => setPanel(null)} title={t("fit.session.replaceTitle")} closeLabel={t("common.close")}>
				{replacing && (
					<>
						<p className={styles.sheetLead}>{t("fit.session.replaceLead", { name: getExercise(replacing.exerciseId).name })}</p>
						{(() => {
							const options = alternativesFor(replacing.exerciseId, profile, workout.exercises.map((b) => b.exerciseId));
							if (options.length === 0) return <EmptyState title={t("fit.session.noAlternatives")} description={t("fit.session.noAlternativesBody")} />;
							return (
								<ChoiceList
									items={options.map((o) => ({
										key: o.id,
										icon: Dumbbell03Icon,
										title: o.name,
										hint: `${t(`fit.level.${o.level}`)} · ${o.equipment.length ? o.equipment.map((e) => t(`fit.opt.equipment.${e}`)).join(", ") : t("fit.exercise.noEquipment")}`,
										onClick: () => {
											dispatch({ type: "replace-planned-exercise", id: workout.id, blockId: replacing.id, exerciseId: o.id });
											toast.show(t("fit.session.replaced", { name: o.name }), "success");
											setPanel(null);
										},
									}))}
								/>
							);
						})()}
					</>
				)}
			</Sheet>
		</div>
	);
}
