"use client";

import { ArrowDownRight01Icon, ArrowUpRight01Icon, Camera01Icon, Clock01Icon, ScaleIcon } from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { PhotoInsightSection } from "@/components/features/PhotoInsight/PhotoInsight";
import { PremiumGate, usePremium } from "@/components/features/PremiumGate/PremiumGate";
import { Button, Card, EmptyState, Icon, Input, ProgressBar, Sheet, useToast } from "@/components/ui";
import { formatDay } from "@/lib/fit/dates";
import { resizeToDataUrl } from "@/lib/fit/image";
import { validateBodyWeightInput } from "@/lib/fit/numberInput";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useUnits } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./CheckIns.module.scss";

const FREE_PHOTOS = 3;

function formatStamp(iso: string | undefined, fallbackDay: string): string {
	if (!iso) return formatDay(fallbackDay);
	const d = new Date(iso);
	return `${formatDay(fallbackDay)}, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function CheckIns() {
	const t = useT();
	const u = useUnits();
	const toast = useToast();
	const { state, dispatch, today } = useFit();
	const premium = usePremium();
	const input = useRef<HTMLInputElement>(null);
	// `null` means "untouched": the field then shows the last saved value instead of an empty box.
	const [weightDraft, setWeightDraft] = useState<string | null>(null);
	const [goalDraft, setGoalDraft] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [removing, setRemoving] = useState<string | null>(null);
	const analysed = (id: string) => state.photoInsights.filter((i) => i.beforePhotoId === id || i.afterPhotoId === id).length;
	const limited = !premium && state.photos.length >= FREE_PHOTOS;

	const entries = state.bodyWeights;
	const latest = entries[entries.length - 1];
	const first = entries[0];
	const lastValue = latest ? String(u.mass(latest.kg, 1)) : "";
	const goalValue = state.goalWeightKg ? String(u.mass(state.goalWeightKg, 1)) : "";
	const weight = weightDraft ?? lastValue;
	const goal = goalDraft ?? goalValue;

	const weightCheck = validateBodyWeightInput(weight, u.units);
	const goalCheck = validateBodyWeightInput(goal, u.units);
	const kg = weightCheck.kg ?? 0;
	const validWeight = weightCheck.kg !== null;
	const goalKg = goalCheck.kg ?? 0;
	const validGoal = goalCheck.kg !== null;
	const goalChanged = validGoal && Math.abs(goalKg - (state.goalWeightKg ?? 0)) > 0.01;

	const change = latest && first && entries.length > 1 ? latest.kg - first.kg : null;
	const toGoalKg = latest && state.goalWeightKg ? latest.kg - state.goalWeightKg : null;
	// Progress from the first logged weight toward the goal.
	const goalPct = first && latest && state.goalWeightKg && first.kg !== state.goalWeightKg ? Math.max(0, Math.min(100, ((first.kg - latest.kg) / (first.kg - state.goalWeightKg)) * 100)) : null;

	const onFile = async (file: File | undefined) => {
		if (!file) return;
		setBusy(true);
		try {
			const dataUrl = await resizeToDataUrl(file);
			dispatch({ type: "add-photo", photo: { id: `p${Date.now()}`, date: today, dataUrl } });
			toast.show(t("fit.progress.photoAdded"), "success");
		} catch {
			toast.show(t("fit.progress.photoError"), "danger");
		} finally {
			setBusy(false);
			if (input.current) input.current.value = "";
		}
	};

	// Newest first; each row compares with the entry before it.
	const history = entries.map((e, i) => ({ ...e, delta: i > 0 ? e.kg - (entries[i - 1]?.kg ?? e.kg) : null })).reverse();
	const towardGoal = (delta: number) => (state.goalWeightKg && latest ? (latest.kg > state.goalWeightKg ? delta < 0 : delta > 0) : false);

	return (
		<>
			<section className={styles.summary} aria-label={t("fit.checkins.summary")}>
				<div className={styles.summaryTop}>
					<span className={styles.summaryIcon}>
						<Icon icon={ScaleIcon} size={22} />
					</span>
					<div>
						<p className={styles.eyebrow}>{t("fit.checkins.current")}</p>
						<strong className={styles.big}>{latest ? `${u.mass(latest.kg, 1)} ${u.unit}` : "—"}</strong>
						{latest && <span className={styles.stamp}>{t("fit.checkins.updated", { when: formatStamp(latest.at, latest.date) })}</span>}
					</div>
				</div>
				<ul className={styles.facts}>
					<li>
						<span>{t("fit.checkins.sinceStart")}</span>
						<strong>{change === null ? "—" : `${change > 0 ? "+" : ""}${u.mass(change, 1)} ${u.unit}`}</strong>
					</li>
					<li>
						<span>{t("fit.progress.goalWeight")}</span>
						<strong>{state.goalWeightKg ? `${u.mass(state.goalWeightKg, 1)} ${u.unit}` : "—"}</strong>
					</li>
					<li>
						<span>{t("fit.checkins.entries")}</span>
						<strong>{entries.length}</strong>
					</li>
				</ul>
				{goalPct !== null && (
					<div className={styles.goalBar}>
						<ProgressBar value={goalPct} label={t("fit.progress.goalWeight")} tone="success" />
						<span>
							{toGoalKg !== null && Math.abs(toGoalKg) < 0.05
								? t("fit.progress.goalReached")
								: t("fit.progress.toGoal", { n: u.mass(Math.abs(toGoalKg ?? 0), 1), unit: u.unit, dir: (toGoalKg ?? 0) > 0 ? t("fit.progress.toLose") : t("fit.progress.toGain") })}
						</span>
					</div>
				)}
			</section>

			<Card className={styles.stack}>
				<h3 className={styles.h3}>{t("fit.progress.logWeight")}</h3>
				<p className={styles.p}>{latest ? t("fit.checkins.lastHint", { value: `${u.mass(latest.kg, 1)} ${u.unit}`, when: formatStamp(latest.at, latest.date) }) : t("fit.checkins.firstHint")}</p>
				<div className={styles.inline}>
					<Input className={styles.grow} label={t("fit.onboarding.weight")} type="text" inputMode="decimal" suffix={u.unit} value={weight} onChange={(e) => setWeightDraft(e.target.value)} error={weightCheck.error ? t("fit.onboarding.errors.weight") : undefined} />
					<Button
						disabled={!validWeight}
						onClick={() => {
							dispatch({ type: "add-body-weight", date: today, kg, at: new Date().toISOString() });
							setWeightDraft(null);
							toast.show(t("fit.checkins.weightSaved"), "success");
						}}
					>
						{t("fit.common.save")}
					</Button>
				</div>
			</Card>

			<Card className={styles.stack}>
				<h3 className={styles.h3}>{t("fit.progress.goalWeight")}</h3>
				<p className={styles.p}>
					{state.goalWeightKg ? t("fit.checkins.goalSet", { value: `${u.mass(state.goalWeightKg, 1)} ${u.unit}`, when: state.goalSetAt ? formatStamp(state.goalSetAt, state.goalSetAt.slice(0, 10)) : "—" }) : t("fit.progress.goalHint")}
				</p>
				<div className={styles.inline}>
					<Input className={styles.grow} label={t("fit.progress.goalWeight")} type="text" inputMode="decimal" suffix={u.unit} value={goal} onChange={(e) => setGoalDraft(e.target.value)} error={goalCheck.error ? t("fit.onboarding.errors.weight") : undefined} />
					<Button
						variant="secondary"
						disabled={!goalChanged}
						onClick={() => {
							dispatch({ type: "set-goal-weight", kg: goalKg, at: new Date().toISOString() });
							setGoalDraft(null);
							toast.show(t("fit.progress.goalSaved"), "success");
						}}
					>
						{t("fit.common.save")}
					</Button>
				</div>
			</Card>

			<section className={styles.historySection}>
				<div className={styles.sectionHead}>
					<h3>{t("fit.checkins.history")}</h3>
					<span>{t("fit.checkins.entryCount", { n: entries.length })}</span>
				</div>
				{history.length === 0 ? (
					<EmptyState title={t("fit.checkins.historyEmpty")} description={t("fit.checkins.historyEmptyBody")} />
				) : (
					<ol className={styles.timeline}>
						{history.map((e) => (
							<li key={`${e.date}-${e.at ?? ""}`} className={styles.entry}>
								<span className={styles.entryDot} aria-hidden>
									<Icon icon={e.at ? Clock01Icon : ScaleIcon} size={14} />
								</span>
								<span className={styles.entryText}>
									<strong>{u.mass(e.kg, 1)} {u.unit}</strong>
									<span>{formatStamp(e.at, e.date)}</span>
								</span>
								{e.delta !== null && Math.abs(e.delta) >= 0.05 && (
									<span className={styles.delta} data-good={towardGoal(e.delta) || undefined}>
										<Icon icon={e.delta > 0 ? ArrowUpRight01Icon : ArrowDownRight01Icon} size={14} />
										{e.delta > 0 ? "+" : ""}{u.mass(e.delta, 1)}
									</span>
								)}
							</li>
						))}
					</ol>
				)}
			</section>

			<Card className={styles.stack}>
				<h3 className={styles.h3}>{t("fit.progress.photos")}</h3>
				<p className={styles.p}>{t("fit.progress.photosNote")}</p>
				<input ref={input} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
				{limited ? <PremiumGate title={t("fit.progress.photosLockedTitle")} body={t("fit.progress.photosLockedBody", { n: FREE_PHOTOS })} source="photos"><span /></PremiumGate> : <Button variant="secondary" iconLeft={Camera01Icon} loading={busy} onClick={() => input.current?.click()}>{t("fit.progress.addPhoto")}</Button>}
				{state.photos.length === 0 ? <EmptyState title={t("fit.progress.photosEmpty")} description={t("fit.progress.photosEmptyBody")} /> : (
					<ul className={styles.photos}>
						{state.photos.map((p) => (
							<li key={p.id}>
								{/* eslint-disable-next-line @next/next/no-img-element -- local data URL, not optimizable */}
								<img src={p.dataUrl} alt={t("fit.progress.photoAlt", { day: formatDay(p.date) })} />
								<span>{formatDay(p.date)}</span>
								{analysed(p.id) > 0 && <span className={styles.analysed}>{t("fit.photoAi.analysedCount", { n: analysed(p.id) })}</span>}
								<button type="button" className={styles.remove} onClick={() => setRemoving(p.id)}>{t("fit.progress.removePhoto")}</button>
							</li>
						))}
					</ul>
				)}
				<PhotoInsightSection />
			</Card>
			<Sheet open={!!removing} onClose={() => setRemoving(null)} title={t("fit.progress.removeTitle")} closeLabel={t("common.close")} variant="center" footer={
				<>
					<Button variant="secondary" onClick={() => setRemoving(null)}>{t("fit.common.cancel")}</Button>
					<Button variant="danger" onClick={() => { if (removing) dispatch({ type: "remove-photo", id: removing }); setRemoving(null); }}>{t("fit.progress.removeConfirm")}</Button>
				</>
			}><p>{t("fit.progress.removeBody")}</p></Sheet>
		</>
	);
}
