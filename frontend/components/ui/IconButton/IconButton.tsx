import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconDefinition } from "../Icon/Icon";
import styles from "./IconButton.module.scss";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
	icon: IconDefinition;
	/** Required: icon-only controls have no visible text. */
	label: string;
	variant?: "ghost" | "secondary";
}

// Always at least 4.4rem square (hit target), regardless of glyph size.
export function IconButton({ icon, label, variant = "ghost", className, type = "button", ...rest }: IconButtonProps) {
	return (
		<button type={type} aria-label={label} className={clsx(styles.iconButton, styles[variant], className)} {...rest}>
			<Icon icon={icon} size={20} />
		</button>
	);
}
