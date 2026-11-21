import clsx from "clsx";
import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui";
import styles from "./Stat.module.scss";

export function Stat({ label, value, hint, icon, className }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; className?: string }) {
	return (
		<div className={clsx(styles.stat, className)}>
			<span className={styles.label}>
				{icon}
				{label}
			</span>
			<span className={styles.value}>{typeof value === "number" ? <AnimatedNumber value={value} /> : value}</span>
			{hint && <span className={styles.hint}>{hint}</span>}
		</div>
	);
}
