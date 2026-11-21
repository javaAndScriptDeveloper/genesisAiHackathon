import clsx from "clsx";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import styles from "./Input.module.scss";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	hint?: string;
	error?: string;
	/** Grey unit shown inside the field on the right (kg, cm, mmHg). */
	suffix?: string;
}

// Uncontrolled-friendly (works with react-hook-form `register`). Focus = border-color change only.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ label, hint, error, suffix, id, className, ...rest },
	ref,
) {
	const autoId = useId();
	const inputId = id ?? autoId;
	const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
	return (
		<div className={clsx(styles.field, className)}>
			{label && (
				<label htmlFor={inputId} className={styles.label}>
					{label}
				</label>
			)}
			<div className={styles.control}>
				<input
					ref={ref}
					id={inputId}
					className={clsx(styles.input, error && styles.invalid, suffix && styles.withSuffix)}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy}
					{...rest}
				/>
				{suffix && (
					<span className={styles.suffix} aria-hidden>
						{suffix}
					</span>
				)}
			</div>
			{error ? (
				<p id={`${inputId}-error`} className={styles.error} role="alert">
					{error}
				</p>
			) : hint ? (
				<p id={`${inputId}-hint`} className={styles.hint}>
					{hint}
				</p>
			) : null}
		</div>
	);
});
