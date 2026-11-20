import clsx from "clsx";
import type { HTMLAttributes } from "react";
import styles from "./Container.module.scss";

export function Container({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
	return <div className={clsx(styles.container, className)} {...rest} />;
}
