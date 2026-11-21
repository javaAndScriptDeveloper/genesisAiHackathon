// Locales the app can show. English is the source language; add a locale by adding a messages/<code>.json
// file and listing it here. Missing keys in a locale fall back to English, never to a blank string.
export const LOCALES = ["en", "uk"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", uk: "Українська" };
export const LOCALE_STORAGE_KEY = "app.locale";

export function isLocale(value: unknown): value is Locale {
	return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
