"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode } from "react";
import { toISO } from "../dates";
import { emptyState } from "../seed";
import type { FitState } from "../types";
import { observeTransition } from "./observe";
import { loadState, saveState } from "./persist";
import { reducer, type Action } from "./reducer";
import { useProgressSync } from "./useProgressSync";

interface FitApi {
	state: FitState;
	dispatch: Dispatch<Action>;
	/** False until saved data has been read; render skeletons until then to avoid hydration mismatches. */
	ready: boolean;
	today: string;
}

const FitContext = createContext<FitApi | null>(null);

const noopSubscribe = () => () => undefined;
const initState = (): FitState => (typeof window === "undefined" ? emptyState() : loadState());

function ProgressSync(): null {
	useProgressSync();
	return null;
}

export function FitProvider({ children }: { children: ReactNode }) {
	// Saved data is read lazily on the client. `ready` is false during server render and hydration, so nothing
	// that depends on saved data renders until hydration has finished (no mismatch), then flips to true.
	const [state, rawDispatch] = useReducer(reducer, undefined, initState);
	const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
	const [today, setToday] = useState(() => toISO(new Date()));
	const prev = useRef<FitState>(state);

	useEffect(() => {
		if (!ready) return;
		saveState(state);
		if (prev.current !== state) observeTransition(prev.current, state);
		prev.current = state;
	}, [state, ready]);

	// Keep "today" right if the tab stays open across midnight, and derive reminders once per day.
	useEffect(() => {
		if (!ready) return;
		const refresh = () => {
			setToday(toISO(new Date()));
			rawDispatch({ type: "sync", now: new Date().toISOString() });
		};
		refresh();
		const id = window.setInterval(refresh, 60_000);
		return () => window.clearInterval(id);
	}, [ready, state.profile]);

	// Browser notifications for new unread items, only when the user opted in and granted permission.
	const notified = useRef<Set<string>>(new Set());
	useEffect(() => {
		if (!ready) return;
		const allow = state.notificationSettings.browserPush && typeof Notification !== "undefined" && Notification.permission === "granted";
		for (const n of state.notifications) {
			if (notified.current.has(n.id)) continue;
			notified.current.add(n.id);
			if (allow && !n.read && Date.now() - new Date(n.createdAt).getTime() < 60_000) new Notification(n.title, { body: n.body });
		}
	}, [state.notifications, state.notificationSettings.browserPush, ready]);

	const dispatch = useCallback<Dispatch<Action>>((a) => rawDispatch(a), []);
	const api = useMemo(() => ({ state, dispatch, ready, today }), [state, dispatch, ready, today]);
	return (
		<FitContext.Provider value={api}>
			<ProgressSync />
			{children}
		</FitContext.Provider>
	);
}

export function useFit(): FitApi {
	const ctx = useContext(FitContext);
	if (!ctx) throw new Error("useFit must be used inside FitProvider");
	return ctx;
}
