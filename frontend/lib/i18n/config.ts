// Locales the app can show: English (default, source) plus the languages of Europe. Russian is intentionally not offered.
// Missing keys in a locale fall back to English, never to a blank string. Add a locale: messages/<code>.json, an entry here and in `loaders.ts`.
export const LOCALES = ["en", "uk", "sq", "eu", "be", "bs", "bg", "ca", "hr", "cs", "da", "nl", "et", "fi", "fr", "gl", "de", "el", "hu", "is", "ga", "it", "lv", "lt", "lb", "mk", "mt", "nb", "pl", "pt", "ro", "sr", "sk", "sl", "es", "sv", "tr", "cy"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
// Each language written in itself, so people can find theirs.
export const LOCALE_LABELS: Record<Locale, string> = {
	en: "English",
	uk: "Українська",
	sq: "Shqip",
	eu: "Euskara",
	be: "Беларуская",
	bs: "Bosanski",
	bg: "Български",
	ca: "Català",
	hr: "Hrvatski",
	cs: "Čeština",
	da: "Dansk",
	nl: "Nederlands",
	et: "Eesti",
	fi: "Suomi",
	fr: "Français",
	gl: "Galego",
	de: "Deutsch",
	el: "Ελληνικά",
	hu: "Magyar",
	is: "Íslenska",
	ga: "Gaeilge",
	it: "Italiano",
	lv: "Latviešu",
	lt: "Lietuvių",
	lb: "Lëtzebuergesch",
	mk: "Македонски",
	mt: "Malti",
	nb: "Norsk",
	pl: "Polski",
	pt: "Português",
	ro: "Română",
	sr: "Српски",
	sk: "Slovenčina",
	sl: "Slovenščina",
	es: "Español",
	sv: "Svenska",
	tr: "Türkçe",
	cy: "Cymraeg",
};
// Flag of the country most associated with each language. Regional languages (Basque, Catalan, Galician, Welsh) use their state or nation.
export const LOCALE_FLAGS: Record<Locale, string> = {
	en: "🇬🇧", uk: "🇺🇦", sq: "🇦🇱", eu: "🇪🇸", be: "🇧🇾", bs: "🇧🇦", bg: "🇧🇬", ca: "🇪🇸", hr: "🇭🇷", cs: "🇨🇿", da: "🇩🇰", nl: "🇳🇱", et: "🇪🇪", fi: "🇫🇮", fr: "🇫🇷", gl: "🇪🇸", de: "🇩🇪", el: "🇬🇷", hu: "🇭🇺", is: "🇮🇸", ga: "🇮🇪", it: "🇮🇹", lv: "🇱🇻", lt: "🇱🇹", lb: "🇱🇺", mk: "🇲🇰", mt: "🇲🇹", nb: "🇳🇴", pl: "🇵🇱", pt: "🇵🇹", ro: "🇷🇴", sr: "🇷🇸", sk: "🇸🇰", sl: "🇸🇮", es: "🇪🇸", sv: "🇸🇪", tr: "🇹🇷", cy: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
};

export const LOCALE_STORAGE_KEY = "app.locale";

export function isLocale(value: unknown): value is Locale {
	return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
