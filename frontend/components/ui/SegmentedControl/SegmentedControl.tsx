"use client";

import clsx from "clsx";
import { useSlidingIndicator } from "@/lib/hooks/useSlidingIndicator";
import styles from "./SegmentedControl.module.scss";

export interface Segment<T extends string> {
	id: T;
	label: string;
}

interface SegmentedControlProps<T extends string> {
	options: Segment<T>[];
	value: T;
	onChange: (id: T) => void;
	label: string;
	className?: string;
}

// Controlled tabs for a few sibling views. A pill slides behind the active tab and the strip scrolls it to the center.
// Selection lives with the caller so it survives navigation.
export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: SegmentedControlProps<T>) {
	const { container, indicator, register } = useSlidingIndicator(value);
	return (
		<div role="tablist" aria-label={label} className={clsx(styles.root, className)} ref={container}>
			<span ref={indicator} className={styles.indicator} aria-hidden />
			{options.map((option) => (
				<button
					key={option.id}
					ref={register(option.id)}
					type="button"
					role="tab"
					aria-selected={option.id === value}
					className={clsx(styles.segment, option.id === value && styles.active)}
					onClick={() => onChange(option.id)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
