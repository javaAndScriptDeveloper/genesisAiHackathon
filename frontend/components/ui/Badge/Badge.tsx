import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./Badge.module.scss";

interface BadgeProps {
	tone?: "neutral" | "accent" | "success" | "warning" | "danger";
	children: ReactNode;
	className?: string;
}

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
	return <span className={clsx(styles.badge, styles[tone], className)}>{children}</span>;
}
