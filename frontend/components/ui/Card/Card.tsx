import clsx from "clsx";
import type { HTMLAttributes } from "react";
import styles from "./Card.module.scss";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	padded?: boolean;
	interactive?: boolean;
}

export function Card({ padded = true, interactive = false, className, ...rest }: CardProps) {
	return <div className={clsx(styles.card, padded && styles.padded, interactive && styles.interactive, className)} {...rest} />;
}
