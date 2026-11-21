"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownRight01Icon, ArrowUpRight01Icon, FullScreenIcon, ScaleIcon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PremiumGate, usePremium } from "@/components/features/PremiumGate/PremiumGate";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { WeightChart } from "@/components/features/WeightChart/WeightChart";
import { Button, Card, EmptyState, Icon, Input, SegmentedControl, Sheet, Skeleton, useToast } from "@/components/ui";
import { formatMonthDay } from "@/lib/fit/dates";
import { MAX_BODY_KG, MIN_BODY_KG, validateBodyWeightInput } from "@/lib/fit/numberInput";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useProgress, useUnits } from "@/lib/fit/store/hooks";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { WeightPeriod } from "@/lib/progress/bodyWeight";
import { BMI_SEGMENTS, WEIGHT_PERIODS, formatWeight, weightScreenView } from "@/lib/progress/weightScreen";
import styles from "./ProgressWeight.module.scss";

const k = "fit.progress.weight";

/** Body weight: start / now / change, interactive chart with 7-day average, BMI by WHO classification, quick weigh-in. */
export function ProgressWeight() {
	const { t, locale } = useI18n();
	const u = useUnits();
	const toast = useToast();
	const premium = usePremium();
	const { state, dispatch, today, ready } = useFit();
	const { history, checkIns } = useProgress();
	const [period, setPeriod] = useState<WeightPeriod>("3m");
	const [expanded, setExpanded] = useState(false);

	const goalKg = checkIns.goalKg;
	const view = useMemo(() => weightScreenView(history.body, state.profile?.heightCm, period, today, premium, goalKg), [history.body, state.profile?.heightCm, period, today, premium, goalKg]);
	const series = view.series;
	const first = series?.dots[0];
	const last = series?.dots[series.dots.length - 1];
	const change = first && last && series.dots.length > 1 ? Math.round((last.kg - first.kg) * 10) / 10 : null;
	const latestKg = checkIns.lastWeighIn?.kg ?? null;
	const toGoal = latestKg !== null && goalKg !== null ? Math.round((latestKg - goalKg) * 10) / 10 : null;
	const fmt = (kg: number) => formatWeight(u.mass(kg, 1), locale);

	const schema = useMemo(
		() =>
			z.object({
				weight: z.string().superRefine((raw, ctx) => {
					const r = validateBodyWeightInput(raw, u.units);
					if (r.kg === null) ctx.addIssue({ code: "custom", message: t(`${k}.errorRange`, { min: u.mass(MIN_BODY_KG, 0), max: u.mass(MAX_BODY_KG, 0), unit: u.unit }) });
				}),
			}),
		[u, t],
	);
	const form = useForm<{ weight: string }>({ resolver: zodResolver(schema), defaultValues: { weight: "" }, mode: "onSubmit" });
	const onSubmit = form.handleSubmit(({ weight }) => {
		const kg = validateBodyWeightInput(weight, u.units).kg;
		if (kg === null) return;
		dispatch({ type: "add-body-weight", date: today, kg, at: new Date().toISOString() });
		form.reset({ weight: "" });
		toast.show(t(`${k}.saved`), "success");
	});

	const chart = (tall: boolean) =>
		series && (
			<WeightChart series={series} fmt={fmt} fmtDate={formatMonthDay} unit={u.unit} goalKg={goalKg} label={t(`${k}.chartLabel`)} tall={tall} />
		);

	return (
		<div className={styles.root}>
			<ScreenHeader title={t(`${k}.screenTitle`)} subtitle={t(`${k}.screenSubtitle`)} back="/progress" />
			<div className={styles.content}>
				{!ready ? (
					<Skeleton height="24rem" />
				) : (
					<>
						<Card className={styles.stack}>
							{view.state === "empty" ? (
								<EmptyState title={t(`${k}.empty`)} description={t(`${k}.emptyBody`)} />
							) : (
								<>
									{series ? (
									<ul className={styles.facts}>
										<li>
											<span>{t(`${k}.start`)}</span>
											<strong>{first ? `${fmt(first.kg)} ${u.unit}` : "—"}</strong>
											{first && <em>{formatMonthDay(first.date)}</em>}
										</li>
										<li>
											<span>{t(`${k}.current`)}</span>
											<strong>{last ? `${fmt(last.kg)} ${u.unit}` : "—"}</strong>
										</li>
										<li>
											<span>{t(`${k}.change`)}</span>
											<strong className={styles.change}>
												{change !== null && Math.abs(change) >= 0.05 && <Icon icon={change > 0 ? ArrowUpRight01Icon : ArrowDownRight01Icon} size={16} />}
												{change === null ? "—" : `${change > 0 ? "+" : change < 0 ? "−" : ""}${fmt(Math.abs(change))} ${u.unit}`}
											</strong>
										</li>
									</ul>
									) : (
										<p className={styles.hint}>{t(`${k}.periodEmptyBody`)}</p>
									)}
									<SegmentedControl
										label={t(`${k}.periods.label`)}
										value={period}
										onChange={setPeriod}
										options={WEIGHT_PERIODS.map((p) => ({ id: p, label: t(`${k}.periods.${p}`) }))}
									/>
									{view.locked ? (
										<PremiumGate title={t(`${k}.lockedTitle`)} body={t(`${k}.lockedBody`)} source="weight">
											<span />
										</PremiumGate>
									) : series ? (
										<>
											{chart(false)}
											<div className={styles.chartFoot}>
												<p className={styles.hint}>{view.state === "single" ? t(`${k}.singleBody`) : t(`${k}.chartHint`)}</p>
												<Button variant="secondary" size="sm" iconLeft={FullScreenIcon} onClick={() => setExpanded(true)}>
													{t(`${k}.expand`)}
												</Button>
											</div>
										</>
									) : (
										<EmptyState title={t(`${k}.periodEmpty`)} description={t(`${k}.periodEmptyBody`)} />
									)}
								</>
							)}
						</Card>

						<Card className={styles.stack}>
							<h3 className={styles.h3}>{t(`${k}.todayTitle`)}</h3>
							<form className={styles.inline} onSubmit={onSubmit} noValidate>
								<Input
									className={styles.grow}
									label={t(`${k}.todayLabel`)}
									type="text"
									inputMode="decimal"
									autoComplete="off"
									suffix={u.unit}
									error={form.formState.errors.weight?.message}
									{...form.register("weight")}
								/>
								<Button type="submit">{t(`${k}.save`)}</Button>
							</form>
							<p className={styles.goalLine}>
								<Icon icon={ScaleIcon} size={16} />
								{goalKg === null
									? t(`${k}.goalNone`)
									: toGoal !== null && Math.abs(toGoal) < 0.05
										? t(`${k}.goalReached`)
										: toGoal !== null
											? t(`${k}.goalLeft`, { n: fmt(Math.abs(toGoal)), unit: u.unit })
											: `${t("fit.progress.goalWeight")}: ${fmt(goalKg)} ${u.unit}`}
							</p>
						</Card>

						<Card className={styles.stack}>
							<h3 className={styles.h3}>{t(`${k}.bmiTitle`)}</h3>
							{view.bmi ? (
								<>
									<p className={styles.bmiValue}>
										<strong>{formatWeight(view.bmi.value, locale)}</strong>
										<span>{t(`${k}.bmi.${view.bmi.category}`)}</span>
									</p>
									<div className={styles.scale} role="img" aria-label={`${t(`${k}.bmiScale`)}: ${t(`${k}.bmiValue`, { value: view.bmi.value })}, ${t(`${k}.bmi.${view.bmi.category}`)}`}>
										<div className={styles.segments}>
											{BMI_SEGMENTS.map((s) => (
												<span key={s.category} className={styles.segment} data-active={s.category === view.bmi?.category || undefined} data-cat={s.category} />
											))}
										</div>
										<span className={styles.marker} style={{ left: `${view.bmi.marker * 100}%` }} />
									</div>
									<ul className={styles.legend} aria-hidden>
										{BMI_SEGMENTS.map((s) => (
											<li key={s.category} data-active={s.category === view.bmi?.category || undefined}>
												{t(`${k}.bmi.${s.category}`)}
											</li>
										))}
									</ul>
									<p className={styles.p}>{t(`${k}.bmiText.${view.bmi.category}`)}</p>
									<p className={styles.note}>{t(`${k}.bmiNote`)}</p>
								</>
							) : (
								<p className={styles.p}>{t(`${k}.bmiNeed`)}</p>
							)}
						</Card>
					</>
				)}
			</div>
			<Sheet open={expanded} onClose={() => setExpanded(false)} title={t(`${k}.chartLabel`)} closeLabel={t("common.close")} variant="full">
				<SegmentedControl label={t(`${k}.periods.label`)} value={period} onChange={setPeriod} options={WEIGHT_PERIODS.map((p) => ({ id: p, label: t(`${k}.periods.${p}`) }))} />
				<div className={styles.expanded}>{view.locked ? null : chart(true)}</div>
			</Sheet>
		</div>
	);
}
