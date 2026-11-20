import type { ReactNode } from "react";
import styles from "./Tooltip.module.scss";

interface TooltipProps {
	text: string;
	children: ReactNode;
}

// CSS-only: shows on hover and keyboard focus within. Never put essential info only in a tooltip.
export function Tooltip({ text, children }: TooltipProps) {
	return (
		<span className={styles.wrap}>
			{children}
			<span role="tooltip" className={styles.tip}>
				{text}
			</span>
		</span>
	);
}
