"use client";

import { Add01Icon, MinusSignIcon } from "@hugeicons/core-free-icons";
import { Icon } from "../Icon/Icon";
import styles from "./Stepper.module.scss";

interface StepperProps {
	value: number;
	compact?: boolean;
	onChange: (value: number) => void;
	label: string;
	unit?: string;
	step?: number;
	min?: number;
	max?: number;
	decreaseLabel?: string;
	increaseLabel?: string;
}

// Large +/- control for gloved or sweaty hands: workout set logging and onboarding numbers.
export function Stepper({ value, compact = false, onChange, label, unit, step = 1, min = 0, max = 999, decreaseLabel = "Decrease", increaseLabel = "Increase" }: StepperProps) {
	const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
	return (
		<div className={styles.root} data-compact={compact || undefined} role="group" aria-label={label}>
			<button type="button" className={styles.button} aria-label={`${decreaseLabel} ${label}`} onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
				<Icon icon={MinusSignIcon} size={20} />
			</button>
			<div className={styles.value} aria-live="polite">
				<span className={styles.number}>{value}</span>
				{unit && <span className={styles.unit}>{unit}</span>}
			</div>
			<button type="button" className={styles.button} aria-label={`${increaseLabel} ${label}`} onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
				<Icon icon={Add01Icon} size={20} />
			</button>
		</div>
	);
}
