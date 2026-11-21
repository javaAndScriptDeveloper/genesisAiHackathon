"use client";

import clsx from "clsx";
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

// Controlled tabs for a few sibling views (Training: Plan / Library). Selection lives with the caller so it survives navigation.
export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: SegmentedControlProps<T>) {
	return (
		<div role="tablist" aria-label={label} className={clsx(styles.root, className)}>
			{options.map((option) => (
				<button
					key={option.id}
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
