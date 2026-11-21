"use client";

import { useState } from "react";
import { Input, SegmentedControl } from "@/components/ui";
import { parseDecimal } from "@/lib/fit/numberInput";
import { cmToFtIn, ftInToCm, KG_PER_LB, massValue, type Units } from "@/lib/fit/units";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Onboarding.module.scss";

interface BodyStepProps {
	units: Units;
	onUnits: (units: Units) => void;
	heightCm: number;
	weightKg: number;
	/** Canonical values (cm, kg). NaN when the field is empty or not a number, so validation can flag it. */
	onHeight: (cm: number) => void;
	onWeight: (kg: number) => void;
	heightError?: string;
	weightError?: string;
}

// Accepts "," or "." (type="number" drops a locale comma in Chrome and turns 62,5 into 625).
const num = (s: string) => parseDecimal(s) ?? Number.NaN;

// Units are asked first; fields then take that unit and always store metric underneath.
export function BodyStep(props: BodyStepProps) {
	const t = useT();
	return (
		<div className={styles.stack}>
			<SegmentedControl
				label={t("fit.onboarding.units")}
				value={props.units}
				onChange={props.onUnits}
				options={[
					{ id: "metric", label: t("fit.onboarding.metric") },
					{ id: "imperial", label: t("fit.onboarding.imperial") },
				]}
			/>
			{/* Re-mounted when the unit changes so the typed values restart from the stored metric numbers. */}
			<Fields key={props.units} {...props} />
		</div>
	);
}

function Fields({ units, heightCm, weightKg, onHeight, onWeight, heightError, weightError }: BodyStepProps) {
	const t = useT();
	const start = cmToFtIn(heightCm);
	const [cm, setCm] = useState(String(Math.round(heightCm)));
	const [ft, setFt] = useState(String(start.ft));
	const [inch, setInch] = useState(String(start.inch));
	const [weight, setWeight] = useState(String(massValue(weightKg, units, 1)));

	const changeWeight = (value: string) => {
		setWeight(value);
		const n = num(value);
		onWeight(units === "metric" ? n : Math.round(n * KG_PER_LB * 10) / 10);
	};

	return (
		<>
			{units === "metric" ? (
				<Input label={t("fit.onboarding.height")} type="text" inputMode="numeric" suffix="cm" value={cm} error={heightError} onChange={(e) => { setCm(e.target.value); onHeight(num(e.target.value)); }} />
			) : (
				<div className={styles.pair}>
					<Input label={t("fit.onboarding.height")} type="text" inputMode="numeric" suffix="ft" value={ft} error={heightError} onChange={(e) => { setFt(e.target.value); onHeight(ftInToCm(num(e.target.value), num(inch) || 0)); }} />
					<Input label={t("fit.onboarding.inches")} type="text" inputMode="numeric" suffix="in" value={inch} onChange={(e) => { setInch(e.target.value); onHeight(ftInToCm(num(ft), num(e.target.value) || 0)); }} />
				</div>
			)}
			<Input label={t("fit.onboarding.weight")} type="text" inputMode="decimal" suffix={units === "metric" ? "kg" : "lb"} value={weight} error={weightError} onChange={(e) => changeWeight(e.target.value)} />
		</>
	);
}
