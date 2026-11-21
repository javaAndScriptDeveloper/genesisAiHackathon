"use client";

import { useEffect, useRef, useState } from "react";
import { createDemoProvider, hrAlert, hrZone, type HealthSample } from "@/lib/fit/health";

interface Options {
	enabled: boolean;
	/** 0 (resting) to 1 (all-out). Read on every sample, so it can change without resubscribing. */
	intensity: number;
	age: number;
	onSample?: (bpm: number) => void;
}

/** Live heart-rate feed. Today only the simulated Demo provider exists; real providers plug in via `HealthProvider`. */
export function useWorkoutHealth({ enabled, intensity, age, onSample }: Options) {
	const [sample, setSample] = useState<HealthSample | null>(null);
	const intensityRef = useRef(intensity);
	const onSampleRef = useRef(onSample);
	const peak = useRef(0);
	const [drop, setDrop] = useState(0);

	useEffect(() => {
		intensityRef.current = intensity;
		onSampleRef.current = onSample;
	});

	useEffect(() => {
		if (!enabled) return;
		let n = 0;
		const provider = createDemoProvider();
		return provider.subscribe((s) => {
			setSample(s);
			n += 1;
			peak.current = Math.max(peak.current * 0.999, s.hr);
			setDrop(Math.max(0, Math.round(peak.current - s.hr)));
			if (n % 5 === 0) onSampleRef.current?.(s.hr);
		}, () => intensityRef.current);
	}, [enabled]);

	return {
		sample,
		zone: sample ? hrZone(sample.hr, age) : null,
		alert: sample ? hrAlert(sample.hr, age) : null,
		/** BPM below the recent peak, useful as a rough recovery indicator while resting. */
		recoveryDrop: drop,
	};
}
