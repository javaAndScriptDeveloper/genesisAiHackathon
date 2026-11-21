"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { hasDict, registerDict, t as translate, type Params } from "@/lib/messages";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, type Locale } from "./config";
import { LOADERS } from "./loaders";

interface I18nApi {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: (key: string, params?: Params) => string;
}

const I18nContext = createContext<I18nApi | null>(null);

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
	listeners.add(cb);
	return () => void listeners.delete(cb);
};
function readLocale(): Locale {
	const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
	return isLocale(saved) ? saved : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
	// The server and the hydrating client both render the default locale; the saved choice applies right after.
	const locale = useSyncExternalStore(subscribe, readLocale, () => DEFAULT_LOCALE);

	// Bumped when a language finishes loading so `t` is rebuilt and the screen re-renders in that language.
	const [loaded, setLoaded] = useState(0);
	useEffect(() => {
		document.documentElement.lang = locale;
		const load = LOADERS[locale];
		if (hasDict(locale) || !load) return;
		let live = true;
		load()
			.then((dict) => {
				registerDict(locale, dict);
				if (live) setLoaded((n) => n + 1);
			})
			.catch(() => undefined); // Offline: English stays on screen.
		return () => {
			live = false;
		};
	}, [locale]);

	const setLocale = useCallback((next: Locale) => {
		window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
		listeners.forEach((cb) => cb());
	}, []);

	const api = useMemo<I18nApi>(() => ({ locale, setLocale, t: (key, params) => translate(key, params, locale) }), [locale, setLocale, loaded]);
	return <I18nContext.Provider value={api}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nApi {
	const ctx = useContext(I18nContext);
	if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
	return ctx;
}

export function useT() {
	return useI18n().t;
}
