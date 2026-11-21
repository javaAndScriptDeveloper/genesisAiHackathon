"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { t as translate, type Params } from "@/lib/messages";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, type Locale } from "./config";

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

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const setLocale = useCallback((next: Locale) => {
		window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
		listeners.forEach((cb) => cb());
	}, []);

	const api = useMemo<I18nApi>(() => ({ locale, setLocale, t: (key, params) => translate(key, params, locale) }), [locale, setLocale]);
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
