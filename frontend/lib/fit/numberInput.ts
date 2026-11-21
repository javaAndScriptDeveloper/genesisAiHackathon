import { toKg, type Units } from "./units";

const DECIMAL = /^(\d+[.,]?\d*|[.,]\d+)$/;

/**
 * Parses what a person typed into a number field. Accepts one "," or "." as the decimal separator
 * (uk-UA keyboards type a comma), surrounding spaces; rejects signs, exponents, letters and repeated separators.
 */
export function parseDecimal(raw: string): number | null {
	const s = raw.trim();
	if (!DECIMAL.test(s)) return null;
	const n = Number(s.replace(",", "."));
	return Number.isFinite(n) ? n : null;
}

export const MIN_BODY_KG = 30;
export const MAX_BODY_KG = 250;

/** Body-weight field: `kg` is the canonical value when valid; an empty field is neither valid nor an error. */
export function validateBodyWeightInput(raw: string, units: Units): { kg: number | null; error: boolean } {
	if (raw.trim() === "") return { kg: null, error: false };
	const n = parseDecimal(raw);
	if (n === null) return { kg: null, error: true };
	const kg = toKg(n, units);
	return kg >= MIN_BODY_KG && kg <= MAX_BODY_KG ? { kg, error: false } : { kg: null, error: true };
}
