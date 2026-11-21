import clsx from "clsx";
import styles from "./ProgressBar.module.scss";

interface ProgressBarProps {
	/** 0 to 100. */
	value: number;
	label: string;
	tone?: "accent" | "success" | "neutral";
	className?: string;
}

export function ProgressBar({ value, label, tone = "accent", className }: ProgressBarProps) {
	const pct = Math.max(0, Math.min(100, Math.round(value)));
	return (
		<div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={clsx(styles.track, className)}>
			<span className={clsx(styles.fill, styles[tone])} style={{ width: `${pct}%` }} />
		</div>
	);
}
