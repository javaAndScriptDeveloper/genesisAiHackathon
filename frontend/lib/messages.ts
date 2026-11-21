import en from "@/messages/en.json";
import uk from "@/messages/uk.json";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

type Dict = { [key: string]: string | Dict };
const DICTS: Record<Locale, Dict> = { en, uk };

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
	const raw = lookup(DICTS[locale], key) ?? lookup(DICTS[DEFAULT_LOCALE], key) ?? key;
	if (!params) return raw;
	return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

/** Replaces every `{name}` in the template; unknown placeholders are left as-is. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const v = vars[name];
		return v === undefined ? match : String(v);
	});
}

export function tf(key: string, vars: Record<string, string | number>): string {
	return interpolate(t(key), vars);
}
