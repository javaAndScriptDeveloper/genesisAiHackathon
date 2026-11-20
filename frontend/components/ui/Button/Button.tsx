import clsx from "clsx";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconDefinition } from "../Icon/Icon";
import styles from "./Button.module.scss";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md" | "lg";
	loading?: boolean;
	iconLeft?: IconDefinition;
	iconRight?: IconDefinition;
	children: ReactNode;
}

export function Button({
	variant = "primary",
	size = "md",
	loading = false,
	iconLeft,
	iconRight,
	disabled,
	className,
	children,
	type = "button",
	...rest
}: ButtonProps) {
	return (
		<button
			type={type}
			className={clsx(styles.button, styles[variant], styles[size], loading && styles.loading, className)}
			disabled={disabled || loading}
			aria-busy={loading || undefined}
			{...rest}
		>
			{loading ? <Icon icon={Loading03Icon} className={styles.spinner} size={18} /> : iconLeft && <Icon icon={iconLeft} size={18} />}
			<span className={styles.label}>{children}</span>
			{iconRight && !loading && <Icon icon={iconRight} size={18} />}
		</button>
	);
}
