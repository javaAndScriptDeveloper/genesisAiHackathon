// Everything is stored in metric (kg, cm). Units only change how numbers are shown and typed.
export type Units = "metric" | "imperial";

export const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const massUnit = (units: Units): "kg" | "lb" => (units === "metric" ? "kg" : "lb");

/** Body weight and totals: `decimals` places in the shown unit. */
export function massValue(kg: number, units: Units, decimals = 0): number {
	const v = units === "metric" ? kg : kg / KG_PER_LB;
	const f = 10 ** decimals;
	return Math.round(v * f) / f;
}

/** Gym loads: 2.5 kg steps in metric, whole pounds in imperial. */
export function loadValue(kg: number, units: Units): number {
	return units === "metric" ? Math.round(kg * 10) / 10 : Math.round(kg / KG_PER_LB);
}

export const loadStep = (units: Units): number => (units === "metric" ? 2.5 : 5);

/** Value typed or stepped in the shown unit, back to canonical kg. */
export function toKg(value: number, units: Units): number {
	return units === "metric" ? value : Math.round(value * KG_PER_LB * 100) / 100;
}

export function fmtMass(kg: number, units: Units, decimals = 0): string {
	return `${massValue(kg, units, decimals).toLocaleString("en-US")} ${massUnit(units)}`;
}

export function fmtLoad(kg: number, units: Units): string {
	return `${loadValue(kg, units).toLocaleString("en-US")} ${massUnit(units)}`;
}

export function cmToFtIn(cm: number): { ft: number; inch: number } {
	const totalIn = Math.round(cm / CM_PER_IN);
	return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}

export function ftInToCm(ft: number, inch: number): number {
	return Math.round((ft * 12 + inch) * CM_PER_IN * 10) / 10;
}

export function fmtHeight(cm: number, units: Units): string {
	if (units === "metric") return `${Math.round(cm)} cm`;
	const { ft, inch } = cmToFtIn(cm);
	return `${ft}′ ${inch}″`;
}
