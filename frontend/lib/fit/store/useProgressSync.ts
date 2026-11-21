"use client";

import { useEffect, useRef, useState } from "react";
import { fetchRemoteSnapshot, planArchive, postArchive, postSync, snapshotOf, toRemote } from "../../api/progressSync";
import { snapshotHash } from "../../progress";
import { useFit } from "./FitProvider";

const DEBOUNCE_MS = 3000;
const RETRY_MS = 60_000;
const HASH_KEY = "fit.progress.lastArchiveHash";

function readHash(): string | null {
	try {
		return window.localStorage.getItem(HASH_KEY);
	} catch {
		return null;
	}
}
function writeHash(h: string): void {
	try {
		window.localStorage.setItem(HASH_KEY, h);
	} catch {
		/* storage unavailable: worst case one extra change snapshot */
	}
}

/**
 * Offline-first sync of progress facts and the snapshot archive. Never blocks the UI: every failure is silent
 * and retried on the next state change or interval tick. Mount once inside FitProvider.
 */
export function useProgressSync(): void {
	const { state, dispatch, ready, today } = useFit();
	const [bootstrapped, setBootstrapped] = useState(false);
	const [tick, setTick] = useState(0);
	const lastSent = useRef<string | null>(null);
	const lastHash = useRef<string | null>(null);
	const flushing = useRef(false);
	const latest = useRef(state);
	latest.current = state;

	// Pull remote facts once when there is no local history.
	useEffect(() => {
		if (!ready) return;
		let alive = true;
		void (async () => {
			if (latest.current.history.length === 0) {
				const snapshot = await fetchRemoteSnapshot(latest.current.progressToken);
				if (alive && snapshot) dispatch({ type: "apply-remote", snapshot });
			}
			if (alive) setBootstrapped(true);
		})();
		return () => {
			alive = false;
		};
	}, [ready, dispatch]);

	// Retry tick for failed requests.
	useEffect(() => {
		if (!ready) return;
		const id = window.setInterval(() => setTick((n) => n + 1), RETRY_MS);
		return () => window.clearInterval(id);
	}, [ready]);

	// Debounced: sync facts, then queue archive items when the numbers changed.
	useEffect(() => {
		if (!ready || !bootstrapped) return;
		const id = window.setTimeout(() => {
			const s = latest.current;
			const body = toRemote(s, today);
			const serialized = JSON.stringify(body);
			if (serialized !== lastSent.current) {
				void postSync(s.progressToken, body).then((ok) => {
					if (ok) lastSent.current = serialized;
				});
			}
			const snap = snapshotOf(s, today);
			const hash = snapshotHash(snap);
			lastHash.current ??= readHash();
			const items = planArchive(s, snap, hash, today, { lastHash: lastHash.current });
			if (items.length > 0) dispatch({ type: "archive-queued", items });
			if (items.some((i) => i.period === "change")) {
				lastHash.current = hash;
				writeHash(hash);
			}
		}, DEBOUNCE_MS);
		return () => window.clearTimeout(id);
	}, [state, today, tick, ready, bootstrapped, dispatch]);

	// Flush the archive queue (oldest first); keep what could not be sent.
	useEffect(() => {
		if (!ready || !bootstrapped || state.archiveQueue.length === 0 || flushing.current) return;
		flushing.current = true;
		const queue = state.archiveQueue;
		const token = state.progressToken;
		void (async () => {
			const ids: string[] = [];
			const weeks: string[] = [];
			for (const item of queue) {
				const result = await postArchive(token, item);
				if (result === "retry") break;
				ids.push(item.id);
				if (result === "sent" && item.period === "weekly" && item.weekStart) weeks.push(item.weekStart);
			}
			flushing.current = false;
			if (ids.length > 0) dispatch({ type: "archive-sent", ids, weeks });
		})();
	}, [state.archiveQueue, state.progressToken, tick, ready, bootstrapped, dispatch]);
}
