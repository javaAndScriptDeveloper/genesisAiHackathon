"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "unsupported" | "denied";

/** Records microphone audio with MediaRecorder. `stop()` resolves with the recording, or null if none was running. */
export function useVoiceRecorder() {
	const [status, setStatus] = useState<RecorderStatus>("idle");
	const recorder = useRef<MediaRecorder | null>(null);
	const chunks = useRef<Blob[]>([]);

	const start = useCallback(async () => {
		if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return setStatus("unsupported");
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const rec = new MediaRecorder(stream);
			chunks.current = [];
			rec.ondataavailable = (e) => chunks.current.push(e.data);
			rec.start();
			recorder.current = rec;
			setStatus("recording");
		} catch {
			setStatus("denied");
		}
	}, []);

	const stop = useCallback(
		() =>
			new Promise<Blob | null>((resolve) => {
				const rec = recorder.current;
				if (!rec || rec.state === "inactive") return resolve(null);
				rec.onstop = () => {
					rec.stream.getTracks().forEach((track) => track.stop());
					recorder.current = null;
					setStatus("idle");
					resolve(new Blob(chunks.current, { type: rec.mimeType }));
				};
				rec.stop();
			}),
		[],
	);

	return { status, start, stop };
}
