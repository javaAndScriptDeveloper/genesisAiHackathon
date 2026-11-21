"use client";

import { useCallback, useSyncExternalStore } from "react";

// Training UI theme for the fitness app: dark (design system default) or light. Saved per browser.
export type Theme = "dark" | "light";

const KEY = "fit.theme";
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
	listeners.add(cb);
	window.addEventListener("storage", cb);
	return () => {
		listeners.delete(cb);
		window.removeEventListener("storage", cb);
	};
};

const read = (): Theme => {
	try {
		return window.localStorage.getItem(KEY) === "light" ? "light" : "dark";
	} catch {
		return "dark";
	}
};

export function useTheme() {
	// Server and hydrating client render dark; the saved choice applies right after.
	const theme = useSyncExternalStore(subscribe, read, (): Theme => "dark");
	const setTheme = useCallback((next: Theme) => {
		try {
			window.localStorage.setItem(KEY, next);
		} catch {
			// Storage blocked: the switch still works for this render cycle.
		}
		listeners.forEach((cb) => cb());
	}, []);
	return { theme, setTheme };
}
