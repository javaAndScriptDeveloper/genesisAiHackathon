import clsx from "clsx";
import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./Switch.module.scss";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> {
	label: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch({ label, className, ...rest }, ref) {
	return (
		<label className={clsx(styles.row, className)}>
			<input ref={ref} type="checkbox" role="switch" className={styles.input} {...rest} />
			<span className={styles.track} aria-hidden>
				<span className={styles.thumb} />
			</span>
			<span className={styles.text}>{label}</span>
		</label>
	);
});
