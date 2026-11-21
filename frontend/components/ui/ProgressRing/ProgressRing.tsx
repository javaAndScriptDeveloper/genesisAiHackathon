import type { ReactNode } from "react";
import styles from "./ProgressRing.module.scss";

interface ProgressRingProps {
	/** 0 to 100. */
	value: number;
	size?: number;
	stroke?: number;
	label: string;
	children?: ReactNode;
}

export function ProgressRing({ value, size = 96, stroke = 8, label, children }: ProgressRingProps) {
	const pct = Math.max(0, Math.min(100, value));
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	return (
		<div className={styles.root} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(pct)}%`}>
			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
				<circle cx={size / 2} cy={size / 2} r={r} className={styles.track} strokeWidth={stroke} fill="none" />
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					className={styles.bar}
					strokeWidth={stroke}
					fill="none"
					strokeLinecap="round"
					strokeDasharray={c}
					strokeDashoffset={c * (1 - pct / 100)}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</svg>
			<div className={styles.content}>{children}</div>
		</div>
	);
}
