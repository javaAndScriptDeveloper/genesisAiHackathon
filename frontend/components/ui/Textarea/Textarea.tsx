import clsx from "clsx";
import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import styles from "../Input/Input.module.scss";
import local from "./Textarea.module.scss";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string;
	hint?: string;
	error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
	{ label, hint, error, id, className, rows = 4, ...rest },
	ref,
) {
	const autoId = useId();
	const fieldId = id ?? autoId;
	const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
	return (
		<div className={clsx(styles.field, className)}>
			{label && (
				<label htmlFor={fieldId} className={styles.label}>
					{label}
				</label>
			)}
			<textarea
				ref={ref}
				id={fieldId}
				rows={rows}
				className={clsx(styles.input, local.textarea, error && styles.invalid)}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				{...rest}
			/>
			{error ? (
				<p id={`${fieldId}-error`} className={styles.error} role="alert">
					{error}
				</p>
			) : hint ? (
				<p id={`${fieldId}-hint`} className={styles.hint}>
					{hint}
				</p>
			) : null}
		</div>
	);
});
