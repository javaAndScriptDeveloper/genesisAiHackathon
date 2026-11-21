"use client";

import { useEffect, useRef } from "react";
import { activeTrainerId } from "../options";
import { fetchNudge, pendingVoice } from "../nudgeClient";
import { showBrowserNotification } from "../notifications";
import { useFit } from "./FitProvider";

// Ids already sent this session (kept outside React so remounts never ask twice); one request at a time, no retries.
const tried = new Set<string>();

/** Rewrites new voiced notifications in the chosen trainer's voice and shows the browser popup once the text is known. */
export function useTrainerVoice(): void {
	const { state, dispatch, ready } = useFit();
	const busy = useRef(false);

	useEffect(() => {
		if (!ready || busy.current) return;
		const next = pendingVoice(state, tried);
		if (!next || !next.nudge) return;
		tried.add(next.id);
		busy.current = true;
		const trainerId = activeTrainerId(state);
		const allowPopup = state.notificationSettings.browserPush;
		void fetchNudge(trainerId, next.nudge).then((text) => {
			busy.current = false;
			dispatch(text ? { type: "notification-voice", id: next.id, text } : { type: "notification-voice-failed", id: next.id });
			if (allowPopup) showBrowserNotification(next, text ?? undefined);
		});
	}, [ready, state, dispatch]);
}
