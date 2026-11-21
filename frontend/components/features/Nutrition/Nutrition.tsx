"use client";

import { Add01Icon, DropletIcon, FireIcon, MinusSignIcon } from "@hugeicons/core-free-icons";
import { Notice } from "@/components/features/Notice/Notice";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Stat } from "@/components/features/Stat/Stat";
import { Button, Card, Checkbox, Icon, ProgressRing, Stepper } from "@/components/ui";
import { useFit } from "@/lib/fit/store/FitProvider";
import type { MealSlot, Profile } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];

/** Rough daily targets (Mifflin-St Jeor, averaged across sexes since gender is optional). Estimates only. */
export function nutritionTargets(p: Profile) {
	const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.gender === "male" ? 5 : p.gender === "female" ? -161 : -78);
	const activity = 1.2 + p.daysPerWeek * 0.06;
	const goalFactor = p.goal === "lose-fat" ? 0.85 : p.goal === "build-muscle" ? 1.1 : 1;
	const kcal = Math.round((bmr * activity * goalFactor) / 10) * 10;
	const protein = Math.round(p.weightKg * (p.goal === "build-muscle" || p.goal === "get-stronger" ? 1.9 : 1.6));
	const fat = Math.round(p.weightKg * 0.9);
	const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
	return { kcal, protein, fat, carbs };
}

export function Nutrition() {
	const t = useT();
	const { state, dispatch, today } = useFit();
	const p = state.profile;
	if (!p) return null;
	const target = nutritionTargets(p);
	const water = state.water[today] ?? 0;
	const meals = state.meals[today] ?? [];
	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.nutrition.title")} back />
			<div className={kit.content}>
				<Notice>{t("fit.nutrition.disclaimer")}</Notice>
				<div className={kit.cols}>
					<Stat label={t("fit.nutrition.calories")} value={target.kcal} hint="kcal" icon={<Icon icon={FireIcon} size={14} />} />
					<Stat label={t("fit.nutrition.protein")} value={target.protein} hint="g" />
					<Stat label={t("fit.nutrition.carbs")} value={target.carbs} hint="g" />
					<Stat label={t("fit.nutrition.fat")} value={target.fat} hint="g" />
				</div>

				<Card className={kit.stack}>
					<h2 className={kit.h2}>{t("fit.nutrition.mealsTitle")}</h2>
					<p className={kit.note}>{t(`fit.nutrition.goalTip.${p.goal}`)}</p>
					{SLOTS.map((slot) => (
						<div key={slot}>
							<Checkbox label={`${t(`fit.nutrition.slot.${slot}`)}: ${t(`fit.nutrition.idea.${slot}`)}`} checked={meals.includes(slot)} onChange={() => dispatch({ type: "toggle-meal", date: today, slot })} />
						</div>
					))}
					<p className={kit.note}>{t("fit.nutrition.mealsDone", { n: meals.length, total: SLOTS.length })}</p>
				</Card>

				<Card className={kit.stack}>
					<h2 className={`${kit.h2} ${kit.heading}`}><Icon icon={DropletIcon} size={20} />{t("fit.nutrition.waterTitle")}</h2>
					<div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
						<ProgressRing value={(water / state.waterGoalMl) * 100} label={t("fit.nutrition.waterTitle")} size={104}>
							<strong>{(water / 1000).toFixed(1)} L</strong>
						</ProgressRing>
						<div className={kit.stack}>
							<Button size="sm" iconLeft={Add01Icon} onClick={() => dispatch({ type: "water", date: today, delta: 250 })}>250 ml</Button>
							<Button size="sm" variant="secondary" iconLeft={Add01Icon} onClick={() => dispatch({ type: "water", date: today, delta: 500 })}>500 ml</Button>
							<Button size="sm" variant="ghost" iconLeft={MinusSignIcon} disabled={water === 0} onClick={() => dispatch({ type: "water", date: today, delta: -250 })}>250 ml</Button>
						</div>
					</div>
					<p className={kit.note}>{water >= state.waterGoalMl ? t("fit.nutrition.goalHit") : t("fit.nutrition.waterLeft", { n: state.waterGoalMl - water })}</p>
					<Stepper label={t("fit.nutrition.goal")} value={state.waterGoalMl} step={250} min={1000} max={6000} unit="ml" onChange={(ml) => dispatch({ type: "water-goal", ml })} />
				</Card>
			</div>
		</div>
	);
}
