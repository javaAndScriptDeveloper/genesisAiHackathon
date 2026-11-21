import en from "@/messages/en.json";
import uk from "@/messages/uk.json";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

type Dict = { [key: string]: string | Dict };
// English and Ukrainian are bundled; every other language registers itself after it has been loaded (see lib/i18n/loaders.ts).
const DICTS: Partial<Record<Locale, Dict>> = { en, uk };

export function registerDict(locale: Locale, dict: Dict): void {
	DICTS[locale] = dict;
}

export function hasDict(locale: Locale): boolean {
	return DICTS[locale] !== undefined;
}

export type Params = Record<string, string | number>;

function lookup(dict: Dict, key: string): string | undefined {
	let node: string | Dict | undefined = dict;
	for (const part of key.split(".")) {
		if (typeof node !== "object" || node === undefined) return undefined;
		node = node[part];
	}
	return typeof node === "string" ? node : undefined;
}

/**
 * Copy lookup with `{name}` interpolation: t("fit.today.hello", { name: "Alex" }).
 * Falls back locale -> English -> the key itself, so a missing translation is visible but never crashes.
 * In client components prefer `useT()` (reads the user's locale); this function defaults to English.
 */
export function t(key: string, params?: Params, locale: Locale = DEFAULT_LOCALE): string {
	const raw = lookup(DICTS[locale] ?? {}, key) ?? lookup(DICTS[DEFAULT_LOCALE] ?? {}, key) ?? key;
	return params ? interpolate(raw, params) : raw;
}

/** Replaces every `{name}` in the template; unknown placeholders are left as-is. */
export function interpolate(template: string, vars: Params): string {
	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const v = vars[name];
		return v === undefined ? match : String(v);
	});
}
