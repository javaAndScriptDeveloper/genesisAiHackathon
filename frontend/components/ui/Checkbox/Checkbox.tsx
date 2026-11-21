import clsx from "clsx";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { forwardRef, type InputHTMLAttributes } from "react";
import { Icon } from "../Icon/Icon";
import styles from "./Checkbox.module.scss";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	label: string;
	compact?: boolean;
}

// The whole row is the hit target (>= 4.4rem tall); the native input stays for a11y and forms.
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, className, compact = false, ...rest }, ref) {
	return (
		<label className={clsx(styles.row, compact && styles.compact, className)}>
			<input ref={ref} type="checkbox" className={styles.input} {...rest} />
			<span className={styles.box} aria-hidden>
				<Icon icon={Tick02Icon} size={14} strokeWidth={3} className={styles.tick} />
			</span>
			<span className={styles.text}>{label}</span>
		</label>
	);
});
