import type { WearableChoice } from "./types";

export type HealthSource = "demo" | "apple" | "garmin";

export interface HealthSample {
	hr: number;
	source: HealthSource;
	/** True when the value is simulated rather than measured. */
	simulated: boolean;
}

export interface ProviderInfo {
	id: Exclude<WearableChoice, "none">;
	name: string;
	description: string;
	/** Real data needs a native app or provider OAuth. In a browser every provider runs in Demo Mode. */
	liveAvailable: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
	{ id: "apple", name: "Apple Health / Apple Watch", description: "Heart rate, workouts and recovery through HealthKit.", liveAvailable: false },
	{ id: "garmin", name: "Garmin Connect", description: "Heart rate, activity and recovery from your Garmin device.", liveAvailable: false },
];

/** Interface a real integration implements. Only the demo implementation ships in the web frontend. */
export interface HealthProvider {
	source: HealthSource;
	subscribe(onSample: (sample: HealthSample) => void, getIntensity: () => number): () => void;
}

/** Simulated heart rate: rises while working, eases down while resting. Always flagged `simulated`. */
export function createDemoProvider(baseline = 72): HealthProvider {
	return {
		source: "demo",
		subscribe(onSample, getIntensity) {
			let hr = baseline + 8;
			let tick = 0;
			const id = window.setInterval(() => {
				tick += 1;
				const target = baseline + 12 + getIntensity() * 78;
				const wobble = Math.sin(tick / 3) * 1.6 + Math.sin(tick / 7) * 1.1;
				hr += (target - hr) * 0.12 + wobble * 0.35;
				onSample({ hr: Math.round(hr), source: "demo", simulated: true });
			}, 1000);
			return () => window.clearInterval(id);
		},
	};
}

export const estimatedMaxHr = (age: number) => Math.max(120, 220 - age);

export function hrZone(hr: number, age: number): { zone: 1 | 2 | 3 | 4 | 5; label: string } {
	const pct = hr / estimatedMaxHr(age);
	if (pct < 0.6) return { zone: 1, label: "Easy" };
	if (pct < 0.7) return { zone: 2, label: "Light" };
	if (pct < 0.8) return { zone: 3, label: "Moderate" };
	if (pct < 0.9) return { zone: 4, label: "Hard" };
	return { zone: 5, label: "Max effort" };
}

/** Plain-language heads-up. Deliberately not a medical statement. */
export function hrAlert(hr: number, age: number): string | null {
	const pct = hr / estimatedMaxHr(age);
	if (pct >= 0.9) return "Your heart rate is very high for your age-based estimate. Slow down and take a longer rest.";
	if (pct >= 0.85) return "Your heart rate is high. Consider a longer rest before the next set.";
	return null;
}
