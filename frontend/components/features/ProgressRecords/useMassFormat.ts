"use client";

import { useMemo } from "react";
import { useUnits } from "@/lib/fit/store/hooks";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Mass strings in the user's unit with the active locale's number format. */
export function useMassFormat() {
	const units = useUnits();
	const { locale } = useI18n();
	return useMemo(() => {
		const num = (v: number, decimals: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
		return {
			mass: (kg: number, decimals = 0) => `${num(units.mass(kg, decimals), decimals)} ${units.unit}`,
			load: (kg: number) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(units.load(kg))} ${units.unit}`,
		};
	}, [units, locale]);
}
